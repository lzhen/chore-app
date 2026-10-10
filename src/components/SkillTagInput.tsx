import '../styles/nesmi-secondary-surfaces.css';
import { useState, useRef, KeyboardEvent } from 'react';

interface SkillTagInputProps {
  skills: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}

const SUGGESTED_SKILLS = [
  'Cooking',
  'Cleaning',
  'Organizing',
  'Laundry',
  'Dishes',
  'Yard Work',
  'Pet Care',
  'Shopping',
  'Repairs',
  'Childcare',
];

export function SkillTagInput({ skills, onChange, placeholder = 'Add a skill...', id, disabled = false }: SkillTagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeSkill = (skillToRemove: string) => {
    onChange(skills.filter(s => s !== skillToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addSkill(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && skills.length > 0) {
      removeSkill(skills[skills.length - 1]);
    }
  };

  const filteredSuggestions = SUGGESTED_SKILLS.filter(
    s => !skills.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="nesmi-skill-input nesmi-secondary-surface relative"
      data-open-picker={!disabled && showSuggestions && filteredSuggestions.length > 0 ? true : undefined}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setShowSuggestions(false); }}
      onKeyDown={event => {
        if (event.key === 'Escape' && showSuggestions && filteredSuggestions.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          inputRef.current?.focus();
          setShowSuggestions(false);
        }
      }}
    >
      {/* Tags display */}
      <div className="flex flex-wrap gap-2 mb-2">
        {skills.map(skill => (
          <span
            key={skill}
            className="nesmi-skill-tag inline-flex items-center gap-1"
          >
            {skill}
            <button
              type="button" disabled={disabled} aria-label={`Remove ${skill} skill`}
              onClick={() => removeSkill(skill)}
              className="nesmi-skill-remove"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>

      {/* Input */}
      <input
        ref={inputRef} type="text" id={id} aria-label={id ? undefined : 'Skills'} disabled={disabled}
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setShowSuggestions(true);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        className="nesmi-secondary-field w-full"
      />

      {/* Suggestions dropdown */}
      {!disabled && showSuggestions && filteredSuggestions.length > 0 && (
        <div className="nesmi-skill-suggestions absolute z-10 w-full mt-1 max-h-40 overflow-y-auto">
          {filteredSuggestions.map(suggestion => (
            <button
              key={suggestion}
              type="button" disabled={disabled}
              onClick={() => { inputRef.current?.focus(); addSkill(suggestion); }}
              className="nesmi-skill-suggestion w-full text-left"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
