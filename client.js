window.__ModuleLoader__.load({
  id: '@bob-cheung/dsh-session-panes',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const PACKAGE = '@bob-cheung/dsh-session-panes'
    const NS = 'sessionPanes'
    const KIND = 'sessionchat'
    const TAB_ID = PACKAGE + '/session-chat'
    const RESOURCE_PROTOCOL = 'sessionchat'
    const RESOURCE_PREFIX = 'dsh-resource://sessionchat/session/'
    const CONVERSATION_SLOT = 'sessionchat.conversation'
    const RETAIN_SOURCE = 'sessionChatPanes'
    /** The drop target is the right 45% of the viewport. */
    const DROP_RATIO = 0.55
    /** Session ids are UUIDs behind a `session-` prefix. */
    const SESSION_ID_PATTERN = /session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

    /** Simplified Chinese dictionary (key-set source of truth). */
    const zh = {
      'action.open': '在右侧打开（可拖到右侧）',
      'action.openAria': '在右侧打开会话 {title}',
      'drop.zone': '拖到此处，在右侧打开该会话',
      'drop.untitled': '未命名会话',
      'tab.unavailable': '无法显示该会话',
      'open.failed': '无法在右侧打开该会话',
    }

    /** English dictionary, key-identical to the Chinese source of truth. */
    const en = {
      'action.open': 'Open in the right sidebar (or drag right)',
      'action.openAria': 'Open session {title} in the right sidebar',
      'drop.zone': 'Drop here to open this session on the right',
      'drop.untitled': 'Untitled session',
      'tab.unavailable': 'This session cannot be displayed',
      'open.failed': 'Could not open the session on the right',
    }

    /**
     * Parse one canonical session-chat resource address.
     * @param {string} value possible resource address.
     * @returns {{ sessionId: string, title: string } | undefined}
     */
    function parseAddress(value) {
      let url
      try {
        url = new URL(value)
      } catch (_invalidUrl) {
        return undefined
      }
      if (url.protocol !== 'dsh-resource:') return undefined
      if (url.hostname.toLowerCase() !== RESOURCE_PROTOCOL) return undefined
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length !== 2 || parts[0] !== 'session') return undefined
      try {
        const sessionId = decodeURIComponent(parts[1])
        if (sessionId === '') return undefined
        return { sessionId, title: url.searchParams.get('title') || '' }
      } catch (_invalidEncoding) {
        return undefined
      }
    }

    /**
     * Address one session as a right-sidebar chat resource.
     * @param {string} sessionId durable Session identity.
     * @param {string} title title captured when the tab opens.
     * @returns {string} canonical resource address.
     */
    function makeAddress(sessionId, title) {
      const query = new URLSearchParams({ title: title || '' })
      return RESOURCE_PREFIX + encodeURIComponent(sessionId) + '?' + query.toString()
    }

    /** Resolve when the tab occurrence ends. */
    function waitForAbort(signal) {
      if (signal.aborted) return Promise.resolve()
      return new Promise((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
    }

    /** One tiny external store shared by the row action and the overlay. */
    function createDragStore() {
      let state = { active: false, x: 0, y: 0, title: '', sessionId: '', native: false }
      const listeners = new Set()
      return {
        get() {
          return state
        },
        set(patch) {
          state = { ...state, ...patch }
          listeners.forEach((listener) => listener())
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    }
    const dragStore = createDragStore()
    /** True while a press that began on our row button is in flight. */
    let nativeRowDragGuard = false

    /** True when a release at this viewport point should open a pane. */
    function inDropZone(x, y) {
      if (typeof x !== 'number' || typeof y !== 'number') return false
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false
      const width = window.innerWidth || 0
      const height = window.innerHeight || 0
      return x >= width * DROP_RATIO && y >= 0 && y <= height
    }

    /** Fixed Chat selection used by the embedded Conversation occurrence. */
    function FixedChatConversationView(props) {
      return h(React.Fragment, null, props.renderSlot('conversation.session', { view: 'chat' }))
    }

    /** Render the shared Conversation content for one explicitly provided session. */
    function ConversationPanel(props) {
      const session = props.useSession((value) => value)
      if (typeof props.renderFactorySlot !== 'function') {
        return props.renderSlot('conversation.session', { view: 'chat' })
      }
      const shellPhase = props.useConversation((value) => value).activeTargets.size > 0
        || (!session.blank && !session.awaitingFirstTurn)
        || session.running
        ? 'active'
        : session.promptAttempted
          ? 'engaging'
          : 'blank'
      const summaryBlank = props.useSessions((state) => state.byId[props.sessionId]?.blank)
      const parentAvailabilityPending = session.subagent?.address.mode === 'continuable'
        && session.subagent.parentAvailable === void 0
      const settling = (shellPhase === 'blank' && session.openState === 'loading' && summaryBlank !== true)
        || parentAvailabilityPending
      const hero = shellPhase === 'blank' && (session.openState === 'open' || summaryBlank === true)
      return props.renderFactorySlot('conversation.content', {
        variant: 'embedded',
        phase: settling ? 'settling' : hero ? 'hero' : 'active',
        hero,
      }, { slots: { views: FixedChatConversationView } })
    }

    /** Sidebar tab body: bind one retained session around the Conversation slot. */
    function SessionChatTab(props) {
      const { useResource, useTabInfo, SessionProvider, renderSlot } = props
      const tabInfo = useTabInfo()
      const resource = useResource(tabInfo.tab.contentId)
      if (typeof SessionProvider !== 'function') {
        return h('div', { className: 'dsh-sp-missing' }, typeof props.t === 'function' ? props.t('tab.unavailable') : 'Unavailable')
      }
      const body = resource !== undefined && resource.value !== undefined
        ? h(SessionProvider, { session: resource.value.reference }, renderSlot(CONVERSATION_SLOT, {}))
        : null
      return h('div', { className: 'dsh-sp-tab' }, body)
    }

    /**
     * Client plugin body.
     * @param {object} ctx client root context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session panes: dictionaries')

      ctx.effect(() => {
        const tag = document.createElement('style')
        tag.dataset.plugin = PACKAGE
        tag.textContent = STYLE_TEXT
        document.head.appendChild(tag)
        return () => tag.remove()
      }, 'session panes: styles')

      /** Best-effort display title for a session id from the catalog. */
      function lookupTitle(sessionId) {
        try {
          const state = ctx.sessions.list.getSnapshot()
          const summary = state && state.byId ? state.byId[sessionId] : undefined
          if (summary === undefined || summary === null) return ''
          return summary.title || summary.displayTitle || ''
        } catch (_unavailable) {
          return ''
        }
      }

      /** Find the Session identity behind a native row drag. */
      function sessionIdFromDrag(target, dataTransfer) {
        if (!(target instanceof Element)) return undefined
        const marked = target.closest('[data-session-id], [data-sessionid], [data-session]')
        if (marked !== null) {
          const value = marked.getAttribute('data-session-id')
            || marked.getAttribute('data-sessionid')
            || marked.getAttribute('data-session')
          if (value) return value
        }
        let node = target
        for (let depth = 0; node !== null && depth < 3; depth += 1, node = node.parentElement) {
          for (const attr of Array.from(node.attributes)) {
            if (attr.name !== 'id' && !/session/i.test(attr.name)) continue
            if (SESSION_ID_PATTERN.test(attr.value)) return attr.value.match(SESSION_ID_PATTERN)[0]
          }
        }
        try {
          const text = dataTransfer ? dataTransfer.getData('text/plain') : ''
          const match = typeof text === 'string' ? text.match(SESSION_ID_PATTERN) : null
          return match ? match[0] : undefined
        } catch (_unreadable) {
          return undefined
        }
      }

      // A Session row is natively draggable (for reordering). A press that began
      // on our own button must not start that drag; a row drag aimed at the right
      // area opens the dragged Session there instead.
      ctx.effect(() => {
        const clearNative = () => {
          if (dragStore.get().native) dragStore.set({ active: false, native: false, sessionId: '' })
        }
        const onDragStart = (event) => {
          if (nativeRowDragGuard) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          if (event.defaultPrevented) return
          // Only the browsing column starts such a drag; dock tabs on the right
          // must keep their own drag behavior.
          if (event.clientX > window.innerWidth * 0.5) return
          const sessionId = sessionIdFromDrag(event.target, event.dataTransfer)
          if (sessionId === undefined) return
          dragStore.set({
            active: true,
            native: true,
            sessionId,
            title: lookupTitle(sessionId),
            x: event.clientX,
            y: event.clientY,
          })
          window.addEventListener('dragend', clearNative, true)
        }
        window.addEventListener('dragstart', onDragStart, true)
        return () => {
          window.removeEventListener('dragstart', onDragStart, true)
          window.removeEventListener('dragend', clearNative, true)
        }
      }, 'session panes: row drag')

      /** Read the session currently filling the main column, when known. */
      function readMounted() {
        try {
          const mounted = ctx.sidebarRight && ctx.sidebarRight.mounted
          if (mounted && typeof mounted.getSnapshot === 'function') return mounted.getSnapshot()
          return mounted
        } catch (_unavailable) {
          /* treat as unavailable */
        }
        return undefined
      }

      /** Retry after a session navigation mints the right-sidebar surface. */
      function retryOpenAside(address, attempt) {
        if (attempt >= 10) {
          console.error(PACKAGE + ': the right sidebar did not become available')
          return
        }
        setTimeout(() => {
          try {
            ctx.sidebarRight.openResource(address, { kind: KIND, preferNewPane: true })
          } catch (_notYet) {
            retryOpenAside(address, attempt + 1)
          }
        }, 80)
      }

      /** Open (or focus) one session as a right-sidebar pane. */
      function openAside(sessionId, displayTitle) {
        if (typeof sessionId !== 'string' || sessionId === '') return
        const address = makeAddress(sessionId, displayTitle || '')
        if (readMounted() === undefined) {
          try {
            ctx.uiWorkspace.openSession(sessionId)
          } catch (error) {
            console.error(PACKAGE + ': cannot open session', error)
            return
          }
          retryOpenAside(address, 0)
          return
        }
        try {
          ctx.sidebarRight.openResource(address, { kind: KIND, preferNewPane: true })
        } catch (error) {
          console.error(PACKAGE + ': cannot open session pane', error)
          retryOpenAside(address, 0)
        }
      }

      /** Floating drag preview plus the highlighted right-hand drop zone. */
      function DropOverlay(props) {
        const t = typeof props.t === 'function' ? props.t : (key) => key
        const [state, setState] = React.useState(dragStore.get())
        React.useEffect(() => dragStore.subscribe(() => setState(dragStore.get())), [])
        if (!state.active) return null
        const onDragOver = (event) => {
          event.preventDefault()
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
        }
        const onDrop = (event) => {
          event.preventDefault()
          event.stopPropagation()
          const current = dragStore.get()
          dragStore.set({ active: false, native: false, sessionId: '' })
          if (current.sessionId) openAside(current.sessionId, current.title)
        }
        return h('div', { className: 'dsh-sp-overlay', 'aria-hidden': 'true' },
          h('div', { className: 'dsh-sp-zone', onDragOver, onDrop },
            h('div', { className: 'dsh-sp-zone-label' }, t('drop.zone'))),
          state.native
            ? null
            : h('div', {
                className: 'dsh-sp-ghost',
                style: { transform: 'translate(' + (state.x + 16) + 'px, ' + (state.y + 16) + 'px)' },
              }, state.title || t('drop.untitled')))
      }

      /** Hover button on one session row: click to open, drag onto the right area. */
      function SessionRowAction(props) {
        const t = typeof props.t === 'function' ? props.t : (key, params) => key
        const sessionId = props.sessionId
        const displayTitle = props.displayTitle || ''
        const suppressClick = React.useRef(false)

        const open = () => openAside(sessionId, displayTitle)

        const onPointerDown = (event) => {
          if (event.button !== 0) return
          if (event.pointerType === 'mouse' && event.buttons !== 1) return
          const element = event.currentTarget
          const startX = event.clientX
          const startY = event.clientY
          const pointerId = event.pointerId
          let dragging = false
          let finished = false

          const cleanup = () => {
            element.removeEventListener('pointermove', onMove)
            element.removeEventListener('pointerup', onEnd)
            element.removeEventListener('pointercancel', onCancel)
            element.removeEventListener('lostpointercapture', onCancel)
            nativeRowDragGuard = false
            try {
              element.releasePointerCapture(pointerId)
            } catch (_notCaptured) {
              /* capture was not acquired */
            }
          }
          const onMove = (moveEvent) => {
            if (finished) return
            if (!dragging && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) >= 6) {
              dragging = true
              dragStore.set({
                active: true,
                x: moveEvent.clientX,
                y: moveEvent.clientY,
                title: displayTitle || sessionId,
              })
            } else if (dragging) {
              dragStore.set({ x: moveEvent.clientX, y: moveEvent.clientY })
            }
          }
          const onEnd = (endEvent) => {
            if (finished) return
            finished = true
            cleanup()
            if (!dragging) return
            dragStore.set({ active: false })
            suppressClick.current = true
            setTimeout(() => {
              suppressClick.current = false
            }, 0)
            if (inDropZone(endEvent.clientX, endEvent.clientY)) open()
          }
          const onCancel = () => {
            if (finished) return
            finished = true
            cleanup()
            dragStore.set({ active: false })
          }

          try {
            element.setPointerCapture(pointerId)
          } catch (_captureFailed) {
            /* capture is optional */
          }
          nativeRowDragGuard = true
          element.addEventListener('pointermove', onMove)
          element.addEventListener('pointerup', onEnd)
          element.addEventListener('pointercancel', onCancel)
          element.addEventListener('lostpointercapture', onCancel)
        }

        const onClick = (event) => {
          if (suppressClick.current) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          open()
        }

        return h('button', {
          type: 'button',
          className: 'dsh-sp-row-action',
          draggable: false,
          'aria-label': t('action.openAria', { title: displayTitle || sessionId }),
          title: t('action.open'),
          onClick,
          onDragStart: (event) => event.preventDefault(),
          onPointerDown,
        }, h('svg', {
          width: 16,
          height: 16,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': 'true',
        },
        h('rect', {
          x: 1.75,
          y: 2.75,
          width: 12.5,
          height: 10.5,
          rx: 2,
          stroke: 'currentColor',
          strokeWidth: 1.2,
        }),
        h('path', { d: 'M9.5 3v10', stroke: 'currentColor', strokeWidth: 1.2 })))
      }

      ctx.inject(['resources', 'sidebarRightTabs'], (scope) => {
        scope.effect(() => scope.resources.register({
          protocol: RESOURCE_PROTOCOL,
          async *open(resourceAddress, { signal }) {
            const parsed = parseAddress(resourceAddress)
            if (parsed === undefined) {
              throw new Error(PACKAGE + ': invalid session chat address "' + resourceAddress + '"')
            }
            if (signal.aborted) return
            const reference = ctx.sessions.retain(parsed.sessionId, { source: RETAIN_SOURCE, signal })
            try {
              yield { ok: true, value: { ...parsed, reference } }
              await waitForAbort(signal)
            } finally {
              reference.release()
            }
          },
        }), 'session panes: chat resources')

        scope.effect(() => scope.sidebarRightTabs.register({
          id: TAB_ID,
          kind: KIND,
          patterns: [RESOURCE_PREFIX + '**'],
          priority: 'extension',
          canOpen: (address) => parseAddress(address) !== undefined,
          title: (address) => {
            const parsed = parseAddress(address)
            if (parsed === undefined) return 'Session'
            return parsed.title || parsed.sessionId.slice(0, 8)
          },
        }), 'session panes: chat tab type')

        scope.slots.inject('sidebar.right.pane.tab', () => scope.slots.register({
          name: 'sidebar.right.pane.tab',
          key: TAB_ID,
          locale: NS,
          children: {
            [CONVERSATION_SLOT]: { kind: 'single', scope: 'session' },
          },
        }, SessionChatTab))

        scope.slots.inject(CONVERSATION_SLOT, () => scope.slots.register({
          name: CONVERSATION_SLOT,
        }, ConversationPanel))

        scope.slots.inject('sidebar.workspaces.session.row.action', () => scope.slots.register({
          name: 'sidebar.workspaces.session.row.action',
          id: 'session-panes-open',
          order: 50,
          locale: NS,
        }, SessionRowAction))

        scope.slots.inject('shell.overlay', () => scope.slots.register({
          name: 'shell.overlay',
          id: 'session-panes-drop',
          order: 1000,
          locale: NS,
        }, DropOverlay))
      })
    }

    const STYLE_TEXT = [
      '.dsh-sp-row-action{display:inline-flex;align-items:center;justify-content:center;',
      'width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;',
      'color:var(--dsw-alias-label-tertiary);cursor:grab;flex:none}',
      '.dsh-sp-row-action:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.dsh-sp-row-action:active{cursor:grabbing}',
      '.dsh-sp-row-action:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.dsh-sp-tab{display:flex;flex-direction:column;width:100%;height:100%;min-height:0;overflow:hidden}',
      '.dsh-sp-missing{padding:16px;font-size:13px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-sp-overlay{position:fixed;inset:0;pointer-events:none;z-index:2147483000}',
      '.dsh-sp-zone{position:absolute;top:6px;right:6px;bottom:6px;width:45vw;min-width:280px;',
      'pointer-events:auto;border:2px dashed var(--dsw-alias-brand-primary);border-radius:14px;',
      'background:color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent);',
      'display:flex;align-items:center;justify-content:center}',
      '.dsh-sp-zone-label{font-size:13px;color:var(--dsw-alias-brand-primary);',
      'background:var(--dsw-alias-bg-overlay);padding:6px 12px;border-radius:999px;',
      'border:1px solid var(--dsw-alias-border-l1);white-space:nowrap}',
      '.dsh-sp-ghost{position:absolute;left:0;top:0;max-width:300px;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap;padding:6px 10px;border-radius:8px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);',
      'color:var(--dsw-alias-label-primary);font-size:12px;',
      'box-shadow:0 6px 22px rgba(0,0,0,0.18);will-change:transform}',
    ].join('')

    return {
      inject: ['sessions', 'uiWorkspace', 'slots', 'locale', 'sidebarRight'],
      apply,
    }
  },
})
