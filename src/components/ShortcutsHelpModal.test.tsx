import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ShortcutsHelpModal } from './ShortcutsHelpModal';
afterEach(cleanup);
function Harness(){const[open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>Help</button><ShortcutsHelpModal isOpen={open} onClose={()=>setOpen(false)}/></>;}
it('uses the shared accessible dialog with keyboard dismissal and focus restoration',async()=>{
 render(<Harness/>);const opener=screen.getByRole('button',{name:'Help'});opener.focus();fireEvent.click(opener);
 const dialog=screen.getByRole('dialog',{name:'Keyboard Shortcuts'});expect(dialog).toHaveAttribute('aria-modal','true');
 expect(screen.getByText('Create new chore')).toBeInTheDocument();fireEvent.keyDown(document,{key:'Escape'});
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(opener).toHaveFocus();
 fireEvent.click(opener);fireEvent.click(screen.getByRole('button',{name:'Close dialog'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 fireEvent.click(opener);fireEvent.click(screen.getByRole('dialog').parentElement!);expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
