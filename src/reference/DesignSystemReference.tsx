import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Logo } from '../components/Logo';
import { ThemeSelector } from '../components/ThemeSelector';
import { ChoicePicker } from '../components/ChoicePicker';
import { ChoreActionsSheet, ChoreTaskDetails, ChoreTaskRow } from '../components/ChoreTaskRow';
import { Dialog } from '../components/Dialog';
import { SectionHeading } from '../components/SectionHeading';
import { useTheme } from '../context/ThemeContext';
import type { Chore, ChoreInstance } from '../types';
import type { InteractionMode } from '../hooks/useInteractionMode';
import '../components/ChoreModal.css';
import './DesignSystemReference.css';

const SAMPLE: Chore = {
  id: 'reference-chore', title: 'Water the balcony plants', date: '2030-04-12',
  dueTime: '09:00', endTime: '09:20', assigneeId: 'alex', recurrence: 'weekly',
  priority: 'medium', estimatedMinutes: 20, categoryId: 'home',
  description: 'Check the soil first. Give each plant a little water, then empty the trays.',
};
const CATEGORY = { id: 'home', name: 'Around the home', color: '#d8ff63' };
const PEOPLE = [
  { id: 'alex', label: 'Alex' }, { id: 'sam', label: 'Sam' },
  { id: 'long', label: 'Alexandra with a deliberately long display name' },
  { id: '', label: 'Unassigned' },
];
function asInstance(chore: Chore, completed = false): ChoreInstance {
  return { ...chore, id: `${chore.id}-instance`, choreId: chore.id,
    assigneeName: PEOPLE.find(person => person.id === (chore.assigneeId || ''))?.label,
    color: CATEGORY.color, isRecurring: chore.recurrence !== 'none', isCompleted: completed };
}
function Section({ id, number, title, note, children }: { id: string; number: string; title: string; note: string; children: ReactNode }) {
  return <section id={id} className="ds-section" aria-labelledby={`${id}-title`}>
    <div className="ds-section-heading"><span className="ds-number" aria-hidden="true">{number}</span><div><h2 id={`${id}-title`}>{title}</h2><p>{note}</p></div></div>
    {children}
  </section>;
}
function Specimen({ title, source, children }: { title: string; source: string; children: ReactNode }) {
  return <div className="ds-specimen"><div className="ds-specimen-heading"><h3>{title}</h3><span>{source}</span></div>{children}</div>;
}

function Confirmation({ title, description, confirmLabel, onClose, onConfirm }: { title: string; description: string; confirmLabel: string; onClose: () => void; onConfirm: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null), descriptionId = useId();
  return <Dialog title={title} variant="centered" role="alertdialog" onClose={onClose} initialFocusRef={cancel} descriptionId={descriptionId} footer={<>
    <button ref={cancel} type="button" className="chore-button secondary" onClick={onClose}>Cancel</button>
    <button type="button" className="chore-button danger" onClick={onConfirm}>{confirmLabel}</button>
  </>}><p id={descriptionId} className="ds-dialog-copy">{description}</p></Dialog>;
}

/** A field specimen, not the context-dependent production ChoreEditor. */
function FieldExample({ chore, onSave, onCancel, onDirtyChange }: { chore: Chore; onSave: (chore: Chore) => void; onCancel?: () => void; onDirtyChange?: (dirty: boolean) => void }) {
  const id = useId(), titleRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(chore), [error, setError] = useState(''), [invalidTitle, setInvalidTitle] = useState(false);
  const [failSave, setFailSave] = useState(false), [discard, setDiscard] = useState(false), [notice, setNotice] = useState('');
  const dirty = draft.title !== chore.title || draft.assigneeId !== chore.assigneeId || draft.description !== chore.description;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { if (onCancel) titleRef.current?.focus(); }, []);
  const cancel = () => dirty ? setDiscard(true) : onCancel?.();
  return <>
    <form className="ds-field-example nesmi-chore-fields" noValidate onSubmit={event => {
      event.preventDefault(); setNotice(''); setInvalidTitle(false);
      if (!draft.title.trim()) { setInvalidTitle(true); setError('Give this sample a title before saving.'); titleRef.current?.focus(); return; }
      if (failSave) { setError('Simulated save failed. Your draft is still here. Turn off the failure example and retry.'); return; }
      setError(''); onSave({ ...draft, title: draft.title.trim() }); setNotice('Sample saved in this page only.');
    }}>
      <label className="chore-label" htmlFor={`${id}-title`}>Chore title
        <input ref={titleRef} id={`${id}-title`} className="chore-input" value={draft.title} onChange={event => { setDraft({ ...draft, title: event.target.value }); setNotice(''); }} aria-invalid={invalidTitle || undefined} aria-describedby={invalidTitle ? `${id}-error` : `${id}-help`} />
      </label>
      <p className="ds-helper" id={`${id}-help`}>Primary input text stays at 16px. Long values can be edited without changing the layout.</p>
      <label className="chore-label" htmlFor={`${id}-person`}>Person</label>
      <ChoicePicker id={`${id}-person`} className="chore-input" label="Sample person" value={draft.assigneeId || ''} options={PEOPLE} onChange={value => setDraft({ ...draft, assigneeId: value || null })}/>
      <label className="chore-label" htmlFor={`${id}-notes`}>Notes
        <textarea id={`${id}-notes`} className="chore-input" rows={3} value={draft.description || ''} onChange={event => setDraft({ ...draft, description: event.target.value })}/>
      </label>
      <label className="ds-checkbox"><input type="checkbox" checked={failSave} onChange={event => setFailSave(event.target.checked)}/> Simulate a recoverable save error</label>
      {error && <p className="chore-error" id={`${id}-error`} role="alert">{error}</p>}
      <div className="ds-actions">{onCancel && <button type="button" className="chore-button secondary" onClick={cancel}>Cancel edit</button>}<button className="chore-button primary" type="submit">Save sample</button></div>
      <p className="ds-live" role="status">{notice}</p>
    </form>
    {discard && <Confirmation title="Discard sample changes?" description="Your changes to this fictional sample have not been saved. Cancel keeps your draft available." confirmLabel="Discard changes" onClose={() => setDiscard(false)} onConfirm={() => { setDiscard(false); onCancel?.(); }}/>} 
  </>;
}

function FieldValueScale() {
  const [title, setTitle] = useState('Water the balcony plants'), [person, setPerson] = useState('alex'), [date, setDate] = useState('2030-04-12');
  return <Specimen title="One field-value scale" source="Current adoption · native input + ChoicePicker">
    <fieldset className="nesmi-chore-fields ds-value-scale"><legend className="sr-only">Compare chore, person and date values</legend>
      <label className="chore-label" htmlFor="ds-scale-title">Chore<input id="ds-scale-title" className="chore-input" value={title} onChange={event => setTitle(event.target.value)}/></label>
      <div><label className="chore-label" htmlFor="ds-scale-person">Person</label><ChoicePicker id="ds-scale-person" label="Value scale person" className="chore-input" value={person} options={PEOPLE} onChange={setPerson}/></div>
      <label className="chore-label" htmlFor="ds-scale-date">Date<input id="ds-scale-date" type="date" className="chore-input" value={date} onChange={event => setDate(event.target.value)}/></label>
    </fieldset>
    <p className="ds-helper">Text, selected people and native date digits share the 16px body scale, family and weight. These fictional fields are editable locally; native date appearance still needs real-browser review.</p>
  </Specimen>;
}

function TaskPattern() {
  const [mode, setMode] = useState<InteractionMode>('web'), [chore, setChore] = useState(SAMPLE);
  const [completed, setCompleted] = useState(false), [editing, setEditing] = useState(false);
  const [actions, setActions] = useState(false), [deleting, setDeleting] = useState(false), [deleted, setDeleted] = useState(false);
  const [notice, setNotice] = useState(''), [dirty, setDirty] = useState(false), [abandoning, setAbandoning] = useState(false);
  const restore = useRef<HTMLButtonElement>(null), stage = useRef<HTMLDivElement>(null), wasEditing = useRef(false);
  const [afterDiscard, setAfterDiscard] = useState<'close' | 'delete'>('close');
  const closeEdit = () => { setEditing(false); setDirty(false); };
  useEffect(() => {
    if (wasEditing.current && !editing && !deleted && !deleting) stage.current?.querySelector<HTMLButtonElement>(mode === 'web' ? '.nesmi-task-row-actions button' : '.nesmi-task-more')?.focus();
    wasEditing.current = editing;
  }, [editing, deleted, deleting, mode]);
  useEffect(() => { if (deleted) restore.current?.focus(); }, [deleted]);
  const instance = asInstance(chore, completed);
  const openEdit = () => { setActions(false); setEditing(true); setNotice(''); };
  const openDelete = () => {
    setActions(false);
    if (editing && dirty) { setAfterDiscard('delete'); setAbandoning(true); return; }
    closeEdit(); setDeleting(true);
  };
  const editor = <FieldExample chore={chore} onSave={value => { setChore(value); closeEdit(); setNotice('Sample updated. No app data was changed.'); }} onCancel={closeEdit} onDirtyChange={setDirty}/>;
  return <>
    <div className="ds-segmented" role="group" aria-label="Task interaction example">
      <button type="button" aria-pressed={mode === 'web'} disabled={editing || actions || deleting} onClick={() => setMode('web')}>Web</button>
      <button type="button" aria-pressed={mode === 'app'} disabled={editing || actions || deleting} onClick={() => setMode('app')}>App simulation</button>
    </div>
    <p className="ds-helper">{mode === 'web' ? 'Select the row to expand details. Hover or focus reveals Edit and Delete; touch keeps actions visible.' : 'Tap the row or More to open its action sheet. This is a browser simulation.'} {editing && 'Save or cancel this draft before switching examples.'}</p>
    <div ref={stage} className="ds-task-stage" data-example-mode={mode}>
      {deleted ? <div className="ds-empty"><p>The fictional chore was removed from this example.</p><button type="button" ref={restore} className="chore-button secondary" onClick={() => { setDeleted(false); closeEdit(); setChore(SAMPLE); setCompleted(false); setNotice('Sample restored.'); }}>Restore sample</button></div> :
        <ChoreTaskRow chore={chore} instance={instance} category={CATEGORY} mode={mode} actionsOpen={actions} onComplete={() => { setCompleted(!completed); setNotice(completed ? 'Sample marked pending.' : 'Sample marked complete.'); }} onEdit={openEdit} onDelete={openDelete} onActions={() => setActions(true)}>
          {editing && mode === 'web' && <div className="nesmi-inline-editor"><div className="nesmi-inline-editor-heading"><h4>Edit fictional chore</h4><span>Field specimen · local state</span></div>{editor}</div>}
        </ChoreTaskRow>}
    </div>
    <p className="ds-live" role="status">{notice}</p>
    {actions && <ChoreActionsSheet chore={chore} instance={instance} category={CATEGORY} onClose={() => setActions(false)} onEdit={openEdit} onDelete={openDelete}/>}
    {editing && mode === 'app' && <Dialog title="Edit fictional chore" onClose={() => { setAfterDiscard('close'); if (dirty) setAbandoning(true); else closeEdit(); }}><div className="nesmi-chore-sheet ds-sheet-editor"><p className="ds-helper">Save applies this fictional sample only. Closing a changed draft asks before discarding it.</p>{editor}</div></Dialog>}
    {abandoning && <Confirmation title="Discard sample changes?" description="Your fictional chore still has unsaved changes. Cancel returns to the editor with your draft intact." confirmLabel="Discard changes" onClose={() => setAbandoning(false)} onConfirm={() => { setAbandoning(false); closeEdit(); if (afterDiscard === 'delete') setDeleting(true); }}/>}
    {deleting && <Confirmation title="Delete this sample series?" description={`“${chore.title}” repeats weekly. This demonstrates a whole-series decision using fictional data only.`} confirmLabel="Delete sample series" onClose={() => setDeleting(false)} onConfirm={() => { setDeleting(false); closeEdit(); setDeleted(true); setNotice('Sample series removed from this page only.'); }}/>} 
  </>;
}

function DialogExample() {
  const [open, setOpen] = useState(false), [person, setPerson] = useState('alex');
  return <>
    <button className="chore-button secondary" type="button" onClick={() => setOpen(true)}>Open dialog example</button>
    {open && <Dialog title="A focused decision" onClose={() => setOpen(false)} footer={<button className="chore-button primary" type="button" onClick={() => setOpen(false)}>Done</button>}>
      <div className="ds-dialog-copy"><p>Open the picker, press Escape to close it, then Escape again to close this dialog. Focus returns to the opener.</p>
        <label className="chore-label" htmlFor="ds-dialog-person">Person</label><ChoicePicker id="ds-dialog-person" label="Dialog person" className="chore-input" value={person} options={PEOPLE} onChange={setPerson}/>
        <p className="ds-helper">Only the top layer owns the keyboard. The background is inert while this dialog is open.</p></div>
    </Dialog>}
  </>;
}

const COLORS = [
  ['Canvas', '--surface-primary', '#FFFFFF', '#080809'],
  ['Raised surface', '--surface-tertiary', '#F3F3F3', '#19191C'],
  ['Primary text', '--text-primary', '#141414', '#F2F2F3'],
  ['Secondary text', '--text-secondary', '#6e6e6e', '#A5A5AD'],
  ['Default border', '--border-default', '#D9D9D9', '#49494F'],
  ['Nesmi highlight', '--chore-highlight', '#D8FF63', '#D8FF63'],
];

export default function DesignSystemReference() {
  const { isDark } = useTheme();
  const [person, setPerson] = useState('alex'), [detailVariant, setDetailVariant] = useState('timed');
  const [actionMessage, setActionMessage] = useState(''), [dangerOpen, setDangerOpen] = useState(false);
  const [fieldSample, setFieldSample] = useState(SAMPLE);
  const detail: Chore = detailVariant === 'long' ? { ...SAMPLE, assigneeId: 'long', description: 'A deliberately long note: check the plants on the balcony and the kitchen windowsill, including the new seedlings. Keep this essential context readable at narrow widths and enlarged text sizes, without truncating it.' } : detailVariant === 'all-day' ? { ...SAMPLE, assigneeId: null, dueTime: undefined, endTime: undefined, recurrence: 'none' } : SAMPLE;
  return <div className="nesmi-design-reference">
    <a className="ds-skip" href="#ds-main">Skip to reference</a>
    <header className="ds-header"><Logo size="sm"/><div className="ds-header-controls"><span className="ds-small">{isDark ? 'Dark' : 'Light'} example</span><ThemeSelector/></div></header>
    <main id="ds-main" className="ds-main" tabIndex={-1}>
      <div className="ds-hero"><p className="ds-eyebrow">Empathie foundations / Nesmi</p><div className="ds-title-row"><h1>Design system</h1><span className="ds-version">Draft v0.1</span></div><p className="ds-intro">A working reference for a calm, readable chore experience. Real components, shared foundations, and clear rules for what comes next.</p>
        <div className="ds-hero-meta"><span>Private preview · fictional data</span><span>Updated 10 October 2026</span></div>
        <div className="ds-actions"><a className="chore-button secondary" href="./index.html?experience=web">Open Web preview ↗</a><a className="chore-button secondary" href="./index.html?experience=app">Open App simulation ↗</a><a className="ds-spec-link" href="./design-system-v0.1.md" target="_blank" rel="noreferrer">Read the v0.1 specification ↗</a></div>
        <p className="ds-helper">Theme changes stay in this reference session. No account, app data, or saved appearance is changed.</p>
      </div>
      <nav className="ds-nav" aria-label="Reference sections">{[['foundations','Foundations'],['typography','Typography'],['color','Color & identity'],['actions','Actions'],['inputs','Inputs'],['patterns','Web & App'],['dialogs','Dialogs'],['quality','Usage & QA']].map(([id,label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
      <Section id="foundations" number="01" title="One foundation, a Nesmi expression" note="Working principles · adoption is intentionally incremental.">
        <div className="ds-three-column"><article className="ds-principle"><span className="ds-status">Implemented</span><h3>Preserve what works</h3><p>Reuse the actual logo, controls, task rows and dialog behavior. Keep Nesmi’s neutral surfaces and lime accent.</p></article><article className="ds-principle"><span className="ds-status">Product adoption</span><h3>Read comfortably</h3><p>Readable values use 16px text, labels 13px and supporting copy 14px across the reviewed Nesmi screens.</p></article><article className="ds-principle"><span className="ds-status">Shared roles</span><h3>Standardize carefully</h3><p>Share semantic roles, spacing and accessibility rules. Nesmi screens share these roles; other Empathie products keep their own adoption plans.</p></article></div>
        <p className="ds-helper">This reference builds on Empathie Visual Guideline v1.1 and the existing Empathie Design System work. Website fonts, blue accents and grids do not automatically become app defaults.</p>
      </Section>
      <Section id="typography" number="02" title="Type with a clear job" note="Existing system font stack · new semantic tokens · no downloaded fonts.">
        <div className="ds-type-list"><div><span className="ds-type-section">A section worth finding</span><span className="ds-type-meta">Section · 20px / 1.3 · adopted section scale</span><code>--nesmi-type-section</code></div><div><span className="ds-type-body">Water the balcony plants before breakfast.</span><span className="ds-type-meta">Body / detail value · 16px / 1.5 · adopted across reviewed surfaces</span><code>--nesmi-type-body</code></div><div><span className="ds-type-label">Person · Date · Repeat</span><span className="ds-type-meta">Label · 13px / 1.4 · adopted across reviewed surfaces</span><code>--nesmi-type-label</code></div></div>
        <Specimen title="Readable task details" source="Live component · ChoreTaskDetails"><div className="ds-segmented" role="group" aria-label="Detail content example">{[['timed','Timed'],['all-day','All day / unassigned'],['long','Long content']].map(([value,label]) => <button key={value} type="button" aria-pressed={detailVariant === value} onClick={() => setDetailVariant(value)}>{label}</button>)}</div><ChoreTaskDetails chore={detail} instance={asInstance(detail)} category={CATEGORY}/></Specimen>
        <p className="ds-helper">Never shrink primary information to make it fit. Detail rows grow; notes and essential values wrap. Compact filters and dense calendar annotations retain documented smaller sizes; page titles and metric counts preserve their hierarchy.</p>
        <div className="ds-heading-example"><Specimen title="Title and period" source="Live component · SectionHeading"><SectionHeading title="Team Workload" context="This Week"/><p className="ds-helper">The section title stays primary. A smaller, secondary period is separated by a subtle vertical rule that stays attached to its text. On the narrowest screens the period moves below, without a dangling divider.</p></Specimen></div>
        <p className="ds-helper">Text, numeric and date values at the same form level share one body-size, font-family and weight contract. A date value is not a headline metric; check native date and time rendering beside the actual text and choice controls.</p>
      </Section>
      <Section id="color" number="03" title="Quiet surfaces. A recognizable signal." note="Current product tokens · theme-aware · Nesmi lime is product-specific.">
        <div className="ds-swatches">{COLORS.map(([name,token,light,dark]) => <div className="ds-swatch" key={token}><div className="ds-swatch-color" style={{ '--ds-swatch': `var(${token})` } as CSSProperties}/><h3>{name}</h3><span>{isDark ? dark : light}</span><code>{token}</code></div>)}</div>
        <div className="ds-two-column"><Specimen title="Header identity" source="Live component · Logo"><div className="ds-logo-stage"><Logo/><Logo size="sm" showText={false}/></div><p className="ds-helper">Approved nest geometry and wordmark. The light header uses a black glyph on transparency; the dark header keeps its approved artwork.</p></Specimen><Specimen title="Spacing and contrast" source="Foundation targets"><div className="ds-spacing" aria-label="Proposed spacing values">{[4,8,12,16,20,24,32].map(value => <div key={value}><span style={{ width: value, height: value }}/><b>{value}</b></div>)}</div><p className="ds-helper">Use 4 / 8 / 12 / 16 / 20 / 24 / 32px as a common vocabulary. Decorative dividers cannot be the only way to identify a control. Contrast targets still require rendered review.</p></Specimen></div>
      </Section>
      <Section id="actions" number="04" title="Make the next action clear" note="Existing chore-button classes · real local interactions · visible keyboard focus.">
        <Specimen title="Action hierarchy and states" source="Current product classes"><div className="ds-actions"><button type="button" className="chore-button primary" onClick={() => setActionMessage('Primary action tried. This example only updates local feedback.')}>Try primary</button><button type="button" className="chore-button secondary" onClick={() => setActionMessage('Secondary action tried. Your app is unchanged.')}>Try secondary</button><button type="button" className="chore-button danger" onClick={() => setDangerOpen(true)}>Try delete decision</button><button type="button" className="chore-button primary" disabled aria-busy="true">Saving…</button><button type="button" className="chore-button secondary" disabled>Disabled</button></div><p className="ds-helper">Saving and Disabled are static state specimens. Try Tab to inspect focus; hover the enabled actions to inspect their current product states.</p><p className="ds-live" role="status">{actionMessage}</p></Specimen>
      </Section>
      <Section id="inputs" number="05" title="Predictable choices and recoverable forms" note="Actual ChoicePicker and form classes · the form is a local field specimen, not the full ChoreEditor.">
        <div className="ds-value-scale-example"><FieldValueScale/></div>
        <div className="ds-two-column"><Specimen title="One choice picker" source="Live component · ChoicePicker"><label className="chore-label" htmlFor="ds-person">Person</label><ChoicePicker id="ds-person" label="Reference person" className="chore-input" value={person} options={PEOPLE} onChange={setPerson}/><p className="ds-helper">Arrows, Home / End, typeahead, Enter / Space and Escape. Selection has a checkmark, not color alone.</p><label className="chore-label" htmlFor="ds-empty-picker">Empty state</label><ChoicePicker id="ds-empty-picker" label="Empty choice example" className="chore-input" value="" options={[]} onChange={() => {}} placeholder="No people yet"/><p className="ds-helper">Open to inspect the explicit empty state. Date and time stay native in the product.</p></Specimen><Specimen title="Form, error and recovery" source="Field specimen · isolated local state"><FieldExample chore={fieldSample} onSave={setFieldSample}/></Specimen></div>
      </Section>
      <Section id="patterns" number="06" title="Shared components, fitting interactions" note="Actual task row and action sheet · example form · browser simulation only."><Specimen title="Try a fictional chore" source="ChoreTaskRow · ChoreActionsSheet"><TaskPattern/></Specimen><div className="ds-two-column ds-rule-columns"><div><h3>Web</h3><p>Details expand in place. Edit opens an inline draft. Hover or focus reveals actions without shifting the row; coarse pointers keep them visible.</p></div><div><h3>App simulation</h3><p>Tap the row or More for a named action sheet. Edit and Delete live in its footer. Read-only sheets close with X, outside click or Escape.</p></div></div></Section>
      <Section id="dialogs" number="07" title="One focused layer at a time" note="Current Dialog behavior · nested picker · focus restoration."><Specimen title="Dialog and nested selection" source="Live components · Dialog + ChoicePicker"><DialogExample/><p className="ds-helper">Escape closes the innermost interaction. Destructive decisions start on Cancel. Repeating chores name the whole-series scope.</p></Specimen></Section>
      <Section id="quality" number="08" title="Use this as a starting contract" note="A guideline is not proof of compliance. Keep verification evidence separate."><div className="ds-two-column ds-rule-columns"><div><h3>When changing a component</h3><ul><li>Reuse its source and semantic tokens before adding a new variant.</li><li>Document loading, empty, error and recovery states.</li><li>Check Light / Dark, long content and keyboard navigation.</li><li>Keep explicit Save / Cancel and protect dirty drafts.</li><li>Update this reference and the component’s behavior tests together.</li></ul></div><div><h3>Rendered review still required</h3><ul><li>320, 360, 390, 430px mobile; 900 and 1440px desktop.</li><li>200% text, coarse pointer, safe areas and virtual keyboard.</li><li>Normal text 4.5:1; large text and essential indicators 3:1.</li><li>Reduced motion, focus order, nested Escape and return focus.</li><li>Browser simulation is not native-device certification.</li></ul></div></div><div className="ds-callout"><strong>Draft v0.1 · Nesmi adoption.</strong><p>Typography and shared controls are adopted across the current Nesmi Web and App-simulation screens, including authentication, family, Insights and Planning tools. See the coverage report for exceptions and evidence. Installed/native releases and other Empathie products have separate delivery steps. No browser or native verification is implied by this reference.</p><a href="./nesmi-adoption-coverage-v0.1.md">Read adoption coverage</a></div></Section>
      <footer className="ds-footer"><span>Nesmi / a practical Empathie foundation</span><a href="#ds-main">Back to top ↑</a></footer>
    </main>
    {dangerOpen && <Confirmation title="Delete this fictional item?" description="This is a safe confirmation example. Continuing only updates the message in the action specimen." confirmLabel="Delete sample" onClose={() => setDangerOpen(false)} onConfirm={() => { setDangerOpen(false); setActionMessage('Fictional delete confirmed. No app data was removed.'); }}/>} 
  </div>;
}
