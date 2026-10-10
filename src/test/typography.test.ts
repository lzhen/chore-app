import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('uses semantic readable task-detail type while retaining hierarchy and narrow-screen wrapping',()=>{
 const tokens=readFileSync('src/styles/nesmi-tokens.css','utf8');
 const styles=readFileSync('src/components/ChoreTaskRow.css','utf8');
 expect(tokens).toContain('--nesmi-type-body: 1rem');expect(tokens).toContain('--nesmi-type-label: .8125rem');
 expect(styles).toContain('font-size: var(--nesmi-type-body, 1rem)');
 expect(styles).toContain('font-size: var(--nesmi-type-label, .8125rem)');
 expect(styles).toContain('overflow-wrap: anywhere');expect(styles).toContain('grid-template-columns: minmax(0,1fr)');
 expect(readFileSync('src/main.tsx','utf8')).toContain("import './styles/nesmi-tokens.css'");
});
it('keeps native date digits and text/person controls on the same readable input scale',()=>{
 const styles=readFileSync('src/components/ChoreModal.css','utf8');
 expect(styles).toContain('.nesmi-chore-fields button.nesmi-choice-trigger.chore-input');
 expect(styles).toContain('font-size: var(--nesmi-type-body, 1rem)');
 expect(styles).toContain('font-weight: 400');
 expect(styles).toContain("input[type='date']::-webkit-datetime-edit");
 expect(styles).toContain('font: inherit');
});
