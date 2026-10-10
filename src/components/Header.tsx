import { useState, type Ref } from 'react';
import { Logo } from './Logo';
import { ViewMode } from '../types';
interface HeaderProps {menuOpen?:boolean;onMenuClick:()=>void;onDashboardClick:()=>void;viewMode:ViewMode;onViewModeChange:(mode:ViewMode)=>void;searchQuery:string;onSearchChange:(query:string)=>void;searchInputRef?:Ref<HTMLInputElement>;}
export function Header({menuOpen=false,onMenuClick,viewMode,onViewModeChange,searchQuery,onSearchChange,searchInputRef}:HeaderProps){
 const [searchOpen,setSearchOpen]=useState(false);const tasks=['calendar','list'].includes(viewMode);
 return <><header className="chore-header nesmi-header-centered" aria-label="Nesmi">
 <div className="nesmi-header-leading"><button type="button" className="touch-button" aria-label="Open family menu" aria-expanded={menuOpen} aria-controls={menuOpen?'nesmi-family-panel':undefined} onClick={onMenuClick}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16 M4 12h16 M4 18h16"/></svg></button></div>
 <div className="chore-brand"><Logo size="sm"/></div>
 <div className="nesmi-header-actions">{<button className="touch-button" aria-label={tasks&&searchOpen?'Close search':'Search chores'} onClick={()=>{if(!tasks){onViewModeChange('list');setSearchOpen(true);}else setSearchOpen(!searchOpen);if(tasks&&searchOpen)onSearchChange('');}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></svg></button>}
</div></header>{tasks&&searchOpen&&<div className="chore-search"><label className="sr-only" htmlFor="chore-search-input">Search chores</label><input id="chore-search-input" autoFocus type="search" className="chore-input" placeholder="Search tasks, people or notes" value={searchQuery} onChange={e=>onSearchChange(e.target.value)} ref={searchInputRef}/></div>}
 </>;
}
