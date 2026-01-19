import { useState, useRef } from 'react';
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

  const stats = getMemberStats(member.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

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

    await updateMember(updatedMember);
    setSaving(false);
    onClose();
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
        setFormData({ ...formData, avatarUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const earnedBadges = member.badges || [];
  const allBadges = BADGES;

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4">
      <div className="fluent-card w-full max-w-4xl max-h-[90vh] overflow-hidden animate-fluent-appear shadow-fluent-28">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="fluent-title text-xl font-semibold text-content-primary">Member Profile</h2>
          <button
            onClick={onClose}
            className="text-content-secondary hover:text-content-primary hover:bg-subtle-background-hover rounded-fluent-sm transition-all duration-fast p-1.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'profile'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('badges')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'badges'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            Badges & Stats
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
          {activeTab === 'profile' ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-6">
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
                      style={{ backgroundColor: member.color }}
                    >
                      {formData.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-content-primary rounded-fluent-md transition-colors text-sm"
                  >
                    Upload Photo
                  </button>
                  {formData.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, avatarUrl: '' })}
                      className="ml-2 px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-fluent-md transition-colors text-sm"
                    >
                      Remove
                    </button>
                  )}
                  <p className="text-xs text-content-secondary mt-2">
                    Or paste an image URL below
                  </p>
                  <input
                    type="url"
                    value={formData.avatarUrl}
                    onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                    placeholder="https://example.com/avatar.jpg"
                    className="mt-2 w-full px-3 py-2 border border-border rounded-fluent-md bg-input-background text-content-primary placeholder-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-border rounded-fluent-md bg-input-background text-content-primary placeholder-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="member@example.com"
                  className="w-full px-3 py-2 border border-border rounded-fluent-md bg-input-background text-content-primary placeholder-content-disabled focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
                />
              </div>

              {/* Skills */}
              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  Skills
                </label>
                <SkillTagInput
                  skills={formData.skills}
                  onChange={(skills) => setFormData({ ...formData, skills })}
                />
              </div>

              {/* Working Hours */}
              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  Working Hours
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={formData.workingHoursStart}
                    onChange={(e) => setFormData({ ...formData, workingHoursStart: e.target.value })}
                    className="px-3 py-2 border border-border rounded-fluent-md bg-input-background text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
                  />
                  <span className="text-content-secondary">to</span>
                  <input
                    type="time"
                    value={formData.workingHoursEnd}
                    onChange={(e) => setFormData({ ...formData, workingHoursEnd: e.target.value })}
                    className="px-3 py-2 border border-border rounded-fluent-md bg-input-background text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Working Days */}
              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  Working Days
                </label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWorkingDay(day.value)}
                      className={`w-10 h-10 rounded-fluent-sm text-sm font-medium transition-colors ${
                        formData.workingDays.includes(day.value)
                          ? 'bg-brand-primary text-white'
                          : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weekly Capacity */}
              <div>
                <label className="block text-sm font-medium text-content-primary mb-2">
                  Weekly Capacity: {Math.floor(formData.weeklyCapacityMinutes / 60)}h {formData.weeklyCapacityMinutes % 60}m
                </label>
                <input
                  type="range"
                  min={0}
                  max={2400}
                  step={30}
                  value={formData.weeklyCapacityMinutes}
                  onChange={(e) => setFormData({ ...formData, weeklyCapacityMinutes: parseInt(e.target.value) })}
                  className="w-full accent-brand-primary"
                />
                <div className="flex justify-between text-xs text-content-secondary mt-1">
                  <span>0h</span>
                  <span>20h</span>
                  <span>40h</span>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-content-primary hover:bg-subtle-background-hover rounded-fluent-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-brand-primary text-white rounded-fluent-md hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          ) : (
            /* Badges & Stats Tab */
            <div className="space-y-6">
              {/* Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="fluent-surface p-4 rounded-fluent-md border border-border text-center">
                  <div className="text-2xl font-bold text-brand-primary">{member.points || 0}</div>
                  <div className="text-sm text-content-secondary">Points</div>
                </div>
                <div className="fluent-surface p-4 rounded-fluent-md border border-border text-center">
                  <div className="text-2xl font-bold text-content-primary">{stats.totalCompleted}</div>
                  <div className="text-sm text-content-secondary">Completed</div>
                </div>
                <div className="fluent-surface p-4 rounded-fluent-md border border-border text-center">
                  <div className="text-2xl font-bold text-orange-500">{stats.currentStreak}</div>
                  <div className="text-sm text-content-secondary">Current Streak</div>
                </div>
                <div className="fluent-surface p-4 rounded-fluent-md border border-border text-center">
                  <div className="text-2xl font-bold text-content-primary">{stats.longestStreak}</div>
                  <div className="text-sm text-content-secondary">Best Streak</div>
                </div>
              </div>

              {/* Earned Badges */}
              <div>
                <h3 className="text-lg font-semibold text-content-primary mb-3">
                  Earned Badges ({earnedBadges.length})
                </h3>
                {earnedBadges.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {earnedBadges.map(badgeId => {
                      const badge = getBadgeById(badgeId);
                      if (!badge) return null;
                      return (
                        <div
                          key={badgeId}
                          className="fluent-surface p-3 rounded-fluent-md border border-border text-center hover:shadow-fluent-8 transition-shadow"
                        >
                          <div className="text-3xl mb-1">{badge.icon}</div>
                          <div className="text-sm font-medium text-content-primary">{badge.name}</div>
                          <div className="text-xs text-content-secondary">{badge.description}</div>
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
                <h3 className="text-lg font-semibold text-content-primary mb-3">
                  Available Badges
                </h3>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {allBadges.filter(b => !earnedBadges.includes(b.id)).map(badge => (
                    <div
                      key={badge.id}
                      className="fluent-surface p-3 rounded-fluent-md border border-border text-center opacity-50"
                    >
                      <div className="text-3xl mb-1 grayscale">{badge.icon}</div>
                      <div className="text-sm font-medium text-content-secondary">{badge.name}</div>
                      <div className="text-xs text-content-disabled">{badge.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
