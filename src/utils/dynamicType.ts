/** Keep the original 16px root at iOS's default 17px body size. */
export function installDynamicType() {
  if (!CSS.supports('font', '-apple-system-body')) return;
  const probe = document.createElement('span');
  probe.textContent = 'M';
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;font:-apple-system-body;line-height:1;white-space:nowrap;';
  document.body.append(probe);
  const mobile = matchMedia('(max-width: 767px)');
  const update = () => {
    const systemSize = parseFloat(getComputedStyle(probe).fontSize);
    document.documentElement.style.fontSize = mobile.matches && Number.isFinite(systemSize)
      ? `${16 * systemSize / 17}px` : '';
  };
  new ResizeObserver(update).observe(probe);
  mobile.addEventListener('change', update);
  update();
}
