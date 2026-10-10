import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPanel } from './ChatPanel';
import { Dialog } from './Dialog';
import { readFileSync } from 'node:fs';
const css = readFileSync('src/components/ChatPanel.css', 'utf8');

const mediaListeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>();
const mediaValues = new Map<string, boolean>();
let resizeCallbacks: ResizeObserverCallback[];
let root: HTMLDivElement;
let opener: HTMLButtonElement;

function setMedia(query: string, matches: boolean) {
  mediaValues.set(query, matches);
  act(() => mediaListeners.get(query)?.forEach(listener => listener({ matches, media: query } as MediaQueryListEvent)));
}
function frame() { act(() => vi.advanceTimersByTime(20)); }
const footer = <form><label htmlFor="test-command">Chore command</label><input id="test-command" /><button type="submit">Send command</button></form>;
function panelProps(open = true) { return { open, onClose: vi.fn(), footer, children: <div role="log">Conversation retained</div> }; }

beforeEach(() => {
  vi.useFakeTimers();
  mediaListeners.clear();
  mediaValues.clear();
  resizeCallbacks = [];
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn((query: string) => ({
    get matches() { return mediaValues.get(query) ?? false; },
    media: query,
    addEventListener: (_: string, callback: (event: MediaQueryListEvent) => void) => {
      if (!mediaListeners.has(query)) mediaListeners.set(query, new Set());
      mediaListeners.get(query)!.add(callback);
    },
    removeEventListener: (_: string, callback: (event: MediaQueryListEvent) => void) => mediaListeners.get(query)?.delete(callback),
  })) });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { resizeCallbacks.push(callback); }
    observe() {}
    disconnect() {}
  });
  root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  opener = document.createElement('button');
  opener.textContent = 'Chat with Agent';
  root.appendChild(opener);
  opener.focus();
});

afterEach(() => {
  cleanup();
  root.remove();
  document.body.style.overflow = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
});

describe('ChatPanel desktop shell', () => {
  it('is nonmodal, leaves Home operable, and only dismisses Escape from the active panel', () => {
    setMedia('(min-width: 1024px)', true);
    const props = panelProps();
    const view = render(<ChatPanel {...props} />);
    frame();
    const panel = screen.getByRole('complementary', { name: 'Chore assistant' });
    expect(panel).not.toHaveAttribute('aria-modal');
    expect(panel).toHaveFocus();
    expect(screen.getByRole('textbox')).not.toHaveFocus();
    expect(root).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
    expect(document.querySelector('.nesmi-chat-backdrop')).toBeNull();
    fireEvent.click(opener);
    expect(props.onClose).not.toHaveBeenCalled();
    opener.focus();
    fireEvent.keyDown(opener, { key: 'Escape' });
    expect(props.onClose).not.toHaveBeenCalled();
    panel.focus();
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledOnce();
    view.rerender(<ChatPanel {...props} open={false} />);
    frame();
    expect(opener).toHaveFocus();
    expect(panel).toHaveAttribute('inert');
    expect(panel).not.toHaveAttribute('role');
  });

  it('tracks actual header and add-bar bounds without reserving document space', () => {
    setMedia('(min-width: 1024px)', true);
    const header = document.createElement('header');
    header.className = 'chore-header';
    const addBar = document.createElement('footer');
    addBar.className = 'nesmi-add-bar';
    root.append(header, addBar);
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({ bottom: 84, height: 84 } as DOMRect);
    vi.spyOn(addBar, 'getBoundingClientRect').mockReturnValue({ top: window.innerHeight - 80, height: 80 } as DOMRect);
    render(<ChatPanel {...panelProps()} />);
    const layer = document.querySelector<HTMLElement>('.nesmi-chat-layer')!;
    expect(layer.style.getPropertyValue('--chat-panel-top')).toBe('96px');
    expect(layer.style.getPropertyValue('--chat-panel-bottom')).toBe('92px');
    vi.mocked(header.getBoundingClientRect).mockReturnValue({ bottom: 100, height: 100 } as DOMRect);
    act(() => resizeCallbacks.forEach(callback => callback([], {} as ResizeObserver)));
    expect(layer.style.getPropertyValue('--chat-panel-top')).toBe('112px');
    expect(layer.parentElement).toBe(document.body);
  });

  it('leaves external desktop modal focus with its original Home trigger', async () => {
    setMedia('(min-width: 1024px)', true);
    const props = panelProps();
    const view = render(<ChatPanel {...props} />);
    frame();
    opener.focus();
    view.rerender(<><ChatPanel {...props} suspended /><Dialog title="Add a chore" onClose={vi.fn()}><input aria-label="Chore" /></Dialog></>);
    frame();
    expect(screen.getByRole('dialog', { name: 'Add a chore' })).toHaveFocus();
    view.rerender(<ChatPanel {...props} />);
    await act(async () => {});
    frame();
    expect(opener).toHaveFocus();
    expect(screen.getByRole('complementary')).not.toHaveFocus();
  });

  it('captures the restored page trigger when opened from a closing dialog', () => {
    setMedia('(min-width: 1024px)', true);
    const props = panelProps(false);
    const view = render(<><ChatPanel {...props} /><Dialog title="Planning tools" onClose={vi.fn()}><button>Open chat</button></Dialog></>);
    frame();
    screen.getByRole('button', { name: 'Open chat' }).focus();
    view.rerender(<ChatPanel {...props} open />);
    frame();
    expect(screen.getByRole('complementary')).toHaveFocus();
    view.rerender(<ChatPanel {...props} />);
    frame();
    expect(opener).toHaveFocus();
  });

  it('detects an independently opened shared dialog and yields keyboard ownership', async () => {
    setMedia('(min-width: 1024px)', true);
    const props = panelProps();
    render(<ChatPanel {...props} />);
    frame();
    const other = document.createElement('div');
    other.setAttribute('role', 'dialog');
    other.tabIndex = -1;
    await act(async () => { document.body.appendChild(other); });
    expect(document.querySelector('.nesmi-chat-layer')).toHaveAttribute('aria-hidden', 'true');
    other.focus();
    fireEvent.keyDown(other, { key: 'Escape' });
    expect(props.onClose).not.toHaveBeenCalled();
    await act(async () => { other.remove(); });
    frame();
    expect(screen.getByRole('complementary')).toHaveFocus();
    expect(root).not.toHaveAttribute('inert');
  });
});

describe('ChatPanel mobile sheet', () => {
  it('focuses the shell, traps Tab, and releases all modal behavior immediately on close', () => {
    const props = panelProps();
    const view = render(<ChatPanel {...props} />);
    frame();
    const panel = screen.getByRole('dialog', { name: 'Chore assistant' });
    expect(panel).toHaveAttribute('aria-modal', 'true');
    expect(panel).toHaveFocus();
    expect(root).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    const close = screen.getByRole('button', { name: 'Close chore assistant' });
    const send = screen.getByRole('button', { name: 'Send command' });
    fireEvent.keyDown(panel, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(send).toHaveFocus();
    fireEvent.keyDown(send, { key: 'Tab' });
    expect(close).toHaveFocus();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Draft stays' } });
    view.rerender(<ChatPanel {...props} open={false} />);
    expect(root).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
    expect(document.querySelector('.nesmi-chat-layer')).not.toHaveAttribute('hidden');
    frame();
    expect(opener).toHaveFocus();
    fireEvent.keyDown(opener, { key: 'Escape' });
    expect(props.onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(document.querySelector('.nesmi-chat-layer')).toHaveAttribute('hidden');
    view.rerender(<ChatPanel {...props} />);
    frame();
    expect(screen.getByRole('textbox')).toBe(input);
    expect(input).toHaveValue('Draft stays');
    expect(screen.getByRole('dialog')).toHaveFocus();
    expect(input).not.toHaveFocus();
  });

  it('suspends for nested forms, restores panel focus, and never strands the root inert', async () => {
    const props = panelProps();
    const modalClose = vi.fn();
    const view = render(<ChatPanel {...props} />);
    frame();
    const panel = screen.getByRole('dialog');
    view.rerender(<><ChatPanel {...props} suspended /><Dialog title="Add a chore" onClose={modalClose}><input aria-label="Chore" /></Dialog></>);
    frame();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Add a chore' })).toHaveFocus();
    expect(panel).toHaveAttribute('inert');
    expect(opener).not.toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(modalClose).toHaveBeenCalledOnce();
    expect(props.onClose).not.toHaveBeenCalled();
    view.rerender(<ChatPanel {...props} />);
    await act(async () => {});
    frame();
    expect(screen.getByRole('dialog', { name: 'Chore assistant' })).toHaveFocus();
    expect(root.inert).toBe(true);
    view.rerender(<ChatPanel {...props} open={false} />);
    frame();
    expect(root.inert).toBe(false);
    expect(root).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
    expect(opener).toHaveFocus();
  });

  it('does not send focus to the opener when closed under a suspended form', () => {
    const props = panelProps();
    const view = render(<ChatPanel {...props} />);
    frame();
    view.rerender(<><ChatPanel {...props} suspended /><Dialog title="Add a chore" onClose={vi.fn()}><input aria-label="Chore" /></Dialog></>);
    frame();
    const form = screen.getByRole('dialog', { name: 'Add a chore' });
    view.rerender(<><ChatPanel {...props} open={false} suspended /><Dialog title="Add a chore" onClose={vi.fn()}><input aria-label="Chore" /></Dialog></>);
    frame();
    expect(form).toHaveFocus();
    expect(opener).not.toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('honors Escape during opening before the first focus frame', () => {
    const props = panelProps();
    render(<ChatPanel {...props} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('uses visualViewport offset, height, and width as the keyboard changes', () => {
    const viewport = new EventTarget();
    Object.assign(viewport, { offsetTop: 35, offsetLeft: 0, width: 390, height: 450 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    render(<ChatPanel {...panelProps()} />);
    const layer = document.querySelector<HTMLElement>('.nesmi-chat-layer')!;
    expect(layer.style.getPropertyValue('--chat-viewport-top')).toBe('35px');
    expect(layer.style.getPropertyValue('--chat-viewport-height')).toBe('450px');
    expect(layer.style.getPropertyValue('--chat-viewport-width')).toBe('390px');
    Object.assign(viewport, { offsetTop: 50, height: 320 });
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(layer.style.getPropertyValue('--chat-viewport-top')).toBe('50px');
    expect(layer.style.getPropertyValue('--chat-viewport-height')).toBe('320px');
  });

  it('releases and reacquires modal locks across breakpoint changes and unmount', () => {
    const view = render(<ChatPanel {...panelProps()} />);
    expect(root.inert).toBe(true);
    setMedia('(min-width: 1024px)', true);
    expect(root.inert).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('complementary')).not.toHaveAttribute('aria-modal');
    setMedia('(min-width: 1024px)', false);
    expect(root.inert).toBe(true);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    view.unmount();
    expect(root.inert).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect([...mediaListeners.values()].every(listeners => listeners.size === 0)).toBe(true);
  });

  it('makes close and backdrop safe while busy and permits dismissal when idle', () => {
    const props = panelProps();
    const view = render(<ChatPanel {...props} busy />);
    frame();
    expect(screen.getByRole('button', { name: 'Close chore assistant' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(document.querySelector('.nesmi-chat-backdrop')!);
    expect(props.onClose).not.toHaveBeenCalled();
    view.rerender(<ChatPanel {...props} />);
    fireEvent.click(document.querySelector('.nesmi-chat-backdrop')!);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('skips transition retention with reduced motion and has one flexible scrolling region', () => {
    setMedia('(prefers-reduced-motion: reduce)', true);
    const props = panelProps();
    const view = render(<ChatPanel {...props} />);
    const panel = screen.getByRole('dialog');
    expect([...panel.children].map(child => child.className)).toEqual(['nesmi-chat-panel-header', 'nesmi-chat-panel-messages', 'nesmi-chat-panel-footer']);
    expect(panel.querySelector('.nesmi-chat-panel-messages [role="log"]')).not.toBeNull();
    expect(panel.querySelector('.nesmi-chat-panel-footer input')).not.toBeNull();
    expect(css).toMatch(/\.nesmi-chat-panel-messages\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/);
    expect(css).toMatch(/\.nesmi-chat-panel-footer\s*\{[^}]*flex:\s*0 0 auto;/);
    expect(css).toContain('env(safe-area-inset-bottom');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    view.rerender(<ChatPanel {...props} open={false} />);
    expect(document.querySelector('.nesmi-chat-layer')).toHaveAttribute('hidden');
  });
});
