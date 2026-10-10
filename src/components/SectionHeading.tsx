import './SectionHeading.css';

/** Keep a section's scope readable without giving it the same weight as its title. */
export function SectionHeading({ title, context }: { title: string; context: string }) {
  return <h3 className="nesmi-section-heading">
    <span className="nesmi-section-heading-title">{title}</span>{' '}
    <span className="nesmi-section-heading-context">{context}</span>
  </h3>;
}
