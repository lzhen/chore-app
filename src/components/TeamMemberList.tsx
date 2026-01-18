import { useState } from 'react';
import { useApp } from '../context/AppContext';

export function TeamMemberList() {
  const { state, addMember, removeMember } = useApp();
  const [newName, setNewName] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      addMember(newName.trim());
      setNewName('');
    }
  };

  return (
    <div className="bg-white border-r border-gray-200 w-64 p-4 flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Team Members</h2>

      <form onSubmit={handleAdd} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add member..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Add
          </button>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto">
        {state.teamMembers.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No team members yet</p>
        ) : (
          <ul className="space-y-2">
            {state.teamMembers.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 group"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: member.color }}
                  />
                  <span className="text-sm text-gray-700">{member.name}</span>
                </div>
                <button
                  onClick={() => removeMember(member.id)}
                  className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove member"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
