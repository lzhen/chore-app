import '../styles/nesmi-secondary-surfaces.css';
import { memberAvatarStyle } from '../utils/colors';
import { useState, useRef, useId, useEffect } from 'react';
import { Dialog } from './Dialog';
import { TeamMember } from '../types';
import { useApp } from '../context/AppContext';
import { SkillTagInput } from './SkillTagInput';
import { BADGES, getBadgeById } from '../data/badges';

interface MemberProfileModalProps {
  member: TeamMember;
  onClose: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export function MemberProfileModal({ member, onClose }: MemberProfileModalProps) {
  const { updateMember, getMemberStats } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const savingRef = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const formId = useId();

  const [formData, setFormData] = useState({
    name: member.name,
    email: member.email || '',
    avatarUrl: member.avatarUrl || '',
    skills: member.skills || [],
    workingHoursStart: member.workingHours?.start || '09:00',
    workingHoursEnd: member.workingHours?.end || '17:00',
    workingDays: member.workingHours?.days || [1, 2, 3, 4, 5],
    weeklyCapacityMinutes: member.weeklyCapacityMinutes || 480, // 8 hours default
  });

  const [activeTab, setActiveTab] = useState<'profile' | 'badges'>('profile');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useEffect(() => {
    if (error) {
      errorRef.current?.focus({ preventScroll: true });
      errorRef.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [error]);
  const originalForm = useRef(formData);
  const changedFields = (Object.keys(formData) as (keyof typeof formData)[])
    .filter(key => JSON.stringify(formData[key]) !== JSON.stringify(originalForm.current[key]));
  const fieldNames: Record<keyof typeof formData, string> = {
    name: 'Name', email: 'Email', avatarUrl: 'Photo', skills: 'Skills',
    workingHoursStart: 'Working hours start', workingHoursEnd: 'Working hours end',
    workingDays: 'Working days', weeklyCapacityMinutes: 'Weekly capacity',
  };
  const requestClose = () => {
    if (savingRef.current) return;
    if (changedFields.length) setConfirmDiscard(true);
    else onClose();
  };

  const stats = getMemberStats(member.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');

    const updatedMember: TeamMember = {
      ...member,
      name: formData.name,
      email: formData.email || undefined,
      avatarUrl: formData.avatarUrl || undefined,
      skills: formData.skills.length > 0 ? formData.skills : undefined,
      workingHours: {
        start: formData.workingHoursStart,
        end: formData.workingHoursEnd,
        days: formData.workingDays,
      },
      weeklyCapacityMinutes: formData.weeklyCapacityMinutes,
    };

    try {
      await updateMember(updatedMember);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this profile. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const toggleWorkingDay = (day: number) => {
    const days = formData.workingDays.includes(day)
      ? formData.workingDays.filter(d => d !== day)
      : [...formData.workingDays, day].sort();
    setFormData({ ...formData, workingDays: days });
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(current => ({ ...current, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const earnedBadges = member.badges || [];
  const allBadges = BADGES;

  return (
    <>
    <Dialog title="Member Profile" onClose={requestClose} busy={saving} footer={activeTab === 'profile' ? <>
      <button type="button" onClick={requestClose} disabled={saving} className="chore-button secondary">Cancel</button>
      <button type="submit" form={formId} disabled={saving} className="chore-button primary">{saving ? 'Saving...' : 'Save Profile'}</button>
    </> : undefined}>
      <div className="nesmi-member-editor nesmi-secondary-surface">
        {/* Tabs */}
        <div className="nesmi-profile-tabs flex border-b border-border" aria-label="Member profile sections">
          <button
            onClick={() => setActiveTab('profile')} aria-pressed={activeTab === 'profile'} disabled={saving}
            className="nesmi-secondary-tab"
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('badges')} aria-pressed={activeTab === 'badges'} disabled={saving}
            className="nesmi-secondary-tab"
          >
            Badges & Stats
          </button>
        </div>

        {/* Content */}
        <div className="nesmi-profile-content">
          {activeTab === 'profile' ? (
            <form id={formId} onSubmit={handleSubmit}>
              <fieldset disabled={saving} className="nesmi-profile-fields space-y-6">
              {error && <p ref={errorRef} tabIndex={-1} className="chore-error nesmi-secondary-support" role="alert">{error} Your entries are still here.</p>}
              {/* Avatar Section */}
              <div className="nesmi-profile-avatar-row flex items-center gap-6">
                <div className="relative">
                  {formData.avatarUrl ? (
                    <img
                      src={formData.avatarUrl}
                      alt={formData.name}
                      className="w-24 h-24 rounded-fluent-circle object-cover border-2 border-border"
                    />
                  ) : (
                    <div
                      className="w-24 h-24 rounded-fluent-circle flex items-center justify-center text-3xl font-bold text-white"
                      style={memberAvatarStyle(member.color)}
                    >
                      {formData.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file" aria-label="Upload member photo"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="chore-button secondary"
                  >
                    Upload Photo
                  </button>
                  {formData.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, avatarUrl: '' })}
                      className="chore-button danger"
                    >
                      Remove
                    </button>
                  )}
                  <p className="nesmi-secondary-support mt-2">
                    Or paste an image URL below
                  </p>
                  <input
                    type="url" aria-label="Photo URL"
                    value={formData.avatarUrl}
                    onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                    placeholder="https://example.com/avatar.jpg"
                    className="nesmi-secondary-field mt-2 w-full"
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label htmlFor={`${formId}-name`} className="nesmi-secondary-label block mb-2">
                  Name
                </label>
                <input
                  type="text" id={`${formId}-name`}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="nesmi-secondary-field w-full"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor={`${formId}-email`} className="nesmi-secondary-label block mb-2">
                  Email
                </label>
                <input
                  type="email" id={`${formId}-email`}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="member@example.com"
                  className="nesmi-secondary-field w-full"
                />
              </div>

              {/* Skills */}
              <div>
                <label htmlFor={`${formId}-skills`} className="nesmi-secondary-label block mb-2">
                  Skills
                </label>
                <SkillTagInput
                  id={`${formId}-skills`} disabled={saving}
                  skills={formData.skills}
                  onChange={(skills) => setFormData({ ...formData, skills })}
                />
              </div>

              {/* Working Hours */}
              <div>
                <p className="nesmi-secondary-label mb-2">Working Hours</p>
                <div className="nesmi-profile-time-row flex items-center gap-2">
                  <input
                    type="time"
                    aria-label="Working hours start" value={formData.workingHoursStart}
                    onChange={(e) => setFormData({ ...formData, workingHoursStart: e.target.value })}
                    className="nesmi-secondary-field"
                  />
                  <span className="text-content-secondary">to</span>
                  <input
                    type="time"
                    aria-label="Working hours end" value={formData.workingHoursEnd}
                    onChange={(e) => setFormData({ ...formData, workingHoursEnd: e.target.value })}
                    className="nesmi-secondary-field"
                  />
                </div>
              </div>

              {/* Working Days */}
              <div>
                <p id={`${formId}-days`} className="nesmi-secondary-label mb-2">Working Days</p>
                <div className="nesmi-profile-days flex flex-wrap gap-2" role="group" aria-labelledby={`${formId}-days`}>
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWorkingDay(day.value)}
                      className="nesmi-profile-day" aria-pressed={formData.workingDays.includes(day.value)}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weekly Capacity */}
              <div>
                <label htmlFor={`${formId}-capacity`} className="nesmi-secondary-label block mb-2">
                  Weekly Capacity: {Math.floor(formData.weeklyCapacityMinutes / 60)}h {formData.weeklyCapacityMinutes % 60}m
                </label>
                <input
                  type="range" id={`${formId}-capacity`}
                  min={0}
                  max={2400}
                  step={30}
                  value={formData.weeklyCapacityMinutes}
                  onChange={(e) => setFormData({ ...formData, weeklyCapacityMinutes: parseInt(e.target.value) })}
                  className="nesmi-profile-capacity w-full"
                />
                <div className="flex justify-between nesmi-secondary-label mt-1">
                  <span>0h</span>
                  <span>20h</span>
                  <span>40h</span>
                </div>
              </div>

              </fieldset>
            </form>
          ) : (
            /* Badges & Stats Tab */
            <div className="space-y-6">
              {/* Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="fluent-surface p-4 rounded-fluent-md border border-border text-center">
                  <div className="text-2xl font-bold text-content-primary">{member.points || 0}</div>
                  <div className="nesmi-secondary-label">Points</div>
                </div>
                <div className="fluent-surface p-4 rounded-fluent-md border border-border text-center">
                  <div className="text-2xl font-bold text-content-primary">{stats.totalCompleted}</div>
                  <div className="nesmi-secondary-label">Completed</div>
                </div>
                <div className="fluent-surface p-4 rounded-fluent-md border border-border text-center">
                  <div className="text-2xl font-bold text-content-primary">{stats.currentStreak}</div>
                  <div className="nesmi-secondary-label">Current Streak</div>
                </div>
                <div className="fluent-surface p-4 rounded-fluent-md border border-border text-center">
                  <div className="text-2xl font-bold text-content-primary">{stats.longestStreak}</div>
                  <div className="nesmi-secondary-label">Best Streak</div>
                </div>
              </div>

              {/* Earned Badges */}
              <div>
                <h3 className="nesmi-secondary-title mb-3">
                  Earned Badges ({earnedBadges.length})
                </h3>
                {earnedBadges.length > 0 ? (
                  <div className="nesmi-profile-badges-grid grid grid-cols-3 md:grid-cols-4 gap-3">
                    {earnedBadges.map(badgeId => {
                      const badge = getBadgeById(badgeId);
                      if (!badge) return null;
                      return (
                        <div
                          key={badgeId}
                          className="fluent-surface p-3 rounded-fluent-md border border-border text-center hover:shadow-fluent-8 transition-shadow"
                        >
                          <div className="text-3xl mb-1">{badge.icon}</div>
                          <div className="nesmi-secondary-body font-medium">{badge.name}</div>
                          <div className="nesmi-secondary-support">{badge.description}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-content-secondary text-center py-6">
                    No badges earned yet. Complete chores to earn badges!
                  </p>
                )}
              </div>

              {/* Available Badges */}
              <div>
                <h3 className="nesmi-secondary-title mb-3">
                  Available Badges
                </h3>
                <div className="nesmi-profile-badges-grid grid grid-cols-3 md:grid-cols-4 gap-3">
                  {allBadges.filter(b => !earnedBadges.includes(b.id)).map(badge => (
                    <div
                      key={badge.id}
                      className="fluent-surface p-3 rounded-fluent-md border border-border text-center nesmi-secondary-unearned"
                    >
                      <div className="text-3xl mb-1 grayscale">{badge.icon}</div>
                      <div className="nesmi-secondary-body font-medium text-content-secondary">{badge.name}</div>
                      <div className="nesmi-secondary-support">{badge.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
    {confirmDiscard && <Dialog title="Discard profile changes?" variant="centered" onClose={() => setConfirmDiscard(false)} initialFocusRef={keepEditingRef} footer={<>
      <button ref={keepEditingRef} type="button" onClick={() => setConfirmDiscard(false)} className="chore-button secondary">Keep editing</button>
      <button type="button" onClick={onClose} className="chore-button secondary">Discard changes</button>
    </>}>
      <div className="nesmi-profile-discard nesmi-secondary-surface">
        <p className="nesmi-secondary-body">Your changes to <strong>{member.name}</strong>’s profile haven’t been saved.</p>
        <p className="nesmi-secondary-support">Changed: {changedFields.map(key => fieldNames[key]).join(', ')}.</p>
      </div>
    </Dialog>}
    </>
  );
}
