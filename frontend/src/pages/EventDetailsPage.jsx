import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { eventApi } from '../api/eventApi';
import { userApi } from '../api/userApi';

const CountdownClock = ({ targetDate, label }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  
  useEffect(() => {
    const calc = () => Math.max(0, new Date(targetDate).getTime() - new Date().getTime());
    setTimeLeft(calc());
    const t = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(t);
  }, [targetDate]);

  const h = Math.floor(timeLeft / 3600000);
  const m = Math.floor((timeLeft % 3600000) / 60000);
  const s = Math.floor((timeLeft % 60000) / 1000);

  if (timeLeft === 0) return <div className="text-[var(--color-accent)] font-bold">{label} Reached!</div>;
  
  return (
    <div className="flex flex-col items-center p-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-48 text-center shrinkage-0">
      <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase mb-1">{label}</span>
      <div className="text-2xl font-mono font-bold font-variant-numeric text-[var(--color-text-primary)]">
        {h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}
      </div>
    </div>
  );
};

export default function EventDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Forms and actions
  const [teamName, setTeamName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);

  // Editing and Organizers
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  
  const [searchOrgQuery, setSearchOrgQuery] = useState('');
  const [searchOrgResults, setSearchOrgResults] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [orgPerms, setOrgPerms] = useState({
    canEditDetails: false, canChangeTiming: false, canChangeDurationWhileRunning: false, canChangePenalty: false
  });

  const fetchEventData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: eventRes } = await eventApi.getEvent(id);
      const ev = eventRes.data;
      setEvent(ev);
      // init edit form
      setEditForm({
        title: ev.title, description: ev.description || '', startDate: new Date(ev.startDate).toISOString().slice(0, 16),
        durationHours: ev.durationHours, durationMinutes: ev.durationMinutes,
        taskViewMode: ev.taskViewMode, scoreMode: ev.scoreMode, wrongSubmissionPenalty: ev.wrongSubmissionPenalty,
        targetTags: ev.targetTags?.join(', ') || '',
        isTeamEvent: ev.isTeamEvent || false,
        minTeamSize: ev.minTeamSize || 1, maxTeamSize: ev.maxTeamSize || 1
      });
      
      if (ev.isTeamEvent) {
        const { data: teamsRes } = await eventApi.listTeams(id);
        setTeams(teamsRes.data);
      }
    } catch {
      console.error('Failed to fetch event data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setActionLoading(true);
    setMessage('');
    try {
      await eventApi.createTeam(id, teamName);
      setTeamName('');
      setMessage('Team created successfully!');
      fetchEventData();
    } catch (err) {
      setMessage(err.response?.data?.error?.message || 'Failed to create team.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSearchUsers = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.length > 1) {
      try {
        const { data } = await userApi.searchUsers(q);
        setSearchResults(data.data);
      } catch {
        setSearchResults([]);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleInvite = async (teamId, userId) => {
    setActionLoading(true);
    setMessage('');
    try {
      await eventApi.inviteToTeam(id, teamId, userId);
      setMessage('Invitation sent.');
      setSearchQuery('');
      setSearchResults([]);
      fetchEventData();
    } catch (err) {
      setMessage(err.response?.data?.error?.message || 'Failed to send invite.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInviteAction = async (inviteId, action) => {
    setActionLoading(true);
    setMessage('');
    try {
      if (action === 'accept') {
        await eventApi.acceptTeamInvite(id, inviteId);
      } else {
        await eventApi.rejectTeamInvite(id, inviteId);
      }
      fetchEventData();
    } catch (err) {
      setMessage(err.response?.data?.error?.message || `Failed to ${action} invite.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        ...editForm,
        startDate: new Date(editForm.startDate).toISOString(),
        targetTags: editForm.targetTags ? editForm.targetTags.split(',').map(t => t.trim()).filter(Boolean) : []
      };
      await eventApi.updateEvent(id, payload);
      setMessage('Event updated successfully!');
      setIsEditing(false);
      fetchEventData();
    } catch (err) {
      setMessage(err.response?.data?.error?.message || 'Failed to update event.');
    } finally { setActionLoading(false); }
  };

  const handleSearchOrgs = async (e) => {
    const q = e.target.value;
    setSearchOrgQuery(q);
    if (q.length > 1) {
      try {
        const { data } = await userApi.searchUsers(q);
        setSearchOrgResults(data.data);
      } catch { setSearchOrgResults([]); }
    } else { setSearchOrgResults([]); }
  };

  const handleAddOrganizer = async (e) => {
    e.preventDefault();
    if (!selectedOrgId) return;
    setActionLoading(true);
    try {
      await eventApi.addOrganizer(id, { userId: selectedOrgId, permissions: orgPerms });
      setMessage('Organizer added/updated.');
      setSelectedOrgId('');
      setSearchOrgQuery('');
      setSearchOrgResults([]);
      fetchEventData();
    } catch (err) {
      setMessage(err.response?.data?.error?.message || 'Failed to add organizer.');
    } finally { setActionLoading(false); }
  };

  if (loading) {
    return <Layout><div className="p-8">Loading event...</div></Layout>;
  }

  if (!event) {
    return <Layout><div className="p-8">Event not found.</div></Layout>;
  }

  const userTeam = teams.find(t => t.members.some(m => m.userId === user.id));
  const pendingInvites = teams.flatMap(t => t.invites || []).filter(i => i.invitedUserId === user.id && i.status === 'pending');

  const isCreator = event.creatorId === user.id;
  const isOrganizer = isCreator || event.organizers?.some(o => o.userId === user.id);
  
  const now = new Date();
  const start = new Date(event.startDate);
  const end = new Date(start.getTime() + (event.durationHours * 3600000) + (event.durationMinutes * 60000));
  
  const isOngoing = event.status === 'ongoing' || (event.status !== 'completed' && event.autoStart && now >= start && now < end);
  const isCompleted = event.status === 'completed' || (event.status !== 'ongoing' && event.autoStart && now >= end);
  const isUpcoming = !isOngoing && !isCompleted;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8 shadow-sm relative">
           <div className="flex justify-between items-start mb-2">
             <h2 className="text-3xl font-bold gradient-text">{event.title}</h2>
             {isOrganizer && (
               <button onClick={() => setIsEditing(!isEditing)} className="btn btn-secondary text-sm px-3 py-1.5">
                 {isEditing ? 'Cancel Edit' : 'Edit Details'}
               </button>
             )}
           </div>
           <p className="text-sm text-[var(--color-text-secondary)] mb-6">
             {new Date(event.startDate).toLocaleString()} • {event.category}
           </p>
           
           {isEditing ? (
             <form onSubmit={handleUpdateEvent} className="p-4 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl space-y-4">
                {message && <div className="text-[var(--color-accent)] text-sm font-bold">{message}</div>}
                <div>
                  <label className="block text-sm mb-1">Title</label>
                  <input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full text-sm" required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Start Date</label>
                    <input type="datetime-local" value={editForm.startDate} onChange={e => setEditForm({...editForm, startDate: e.target.value})} className="w-full text-sm" required />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Duration</label>
                    <div className="flex gap-2">
                      <input type="number" min="0" value={editForm.durationHours} onChange={e => setEditForm({...editForm, durationHours: Number(e.target.value)})} className="w-full text-sm" placeholder="Hrs" />
                      <input type="number" min="0" max="59" value={editForm.durationMinutes} onChange={e => setEditForm({...editForm, durationMinutes: Number(e.target.value)})} className="w-full text-sm" placeholder="Mins" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1">Target Tags (Comma separated)</label>
                  <input type="text" value={editForm.targetTags} onChange={e => setEditForm({...editForm, targetTags: e.target.value})} className="w-full text-sm" placeholder="e.g. cohort-2029" />
                </div>
                <div className="flex items-center gap-4 p-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editForm.isTeamEvent} onChange={e => setEditForm({...editForm, isTeamEvent: e.target.checked})} className="rounded text-[var(--color-accent)]" />
                    Is Team Event?
                  </label>
                  {editForm.isTeamEvent && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-sm">Min:</label>
                        <input type="number" min="1" value={editForm.minTeamSize} onChange={e => setEditForm({...editForm, minTeamSize: Number(e.target.value)})} className="w-16 text-sm" />
                       </div>
                       <div className="flex items-center gap-2">
                        <label className="text-sm">Max:</label>
                        <input type="number" min="1" value={editForm.maxTeamSize} onChange={e => setEditForm({...editForm, maxTeamSize: Number(e.target.value)})} className="w-16 text-sm" />
                       </div>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Task View Mode</label>
                    <select value={editForm.taskViewMode} onChange={e => setEditForm({...editForm, taskViewMode: e.target.value})} className="w-full text-sm bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-2">
                      <option value="all">All At Once</option>
                      <option value="dynamic">Dynamic Unlocking</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Score Mode</label>
                    <select value={editForm.scoreMode} onChange={e => setEditForm({...editForm, scoreMode: e.target.value})} className="w-full text-sm bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-2">
                       <option value="constant">Constant</option>
                       <option value="dynamic">Dynamic Decay</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1" title="Penalty points per wrong submission">Wrong Penalty</label>
                    <input type="number" min="0" value={editForm.wrongSubmissionPenalty} onChange={e => setEditForm({...editForm, wrongSubmissionPenalty: Number(e.target.value)})} className="w-full text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1">Description</label>
                  <textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className="w-full text-sm bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2 rounded-lg" rows="4" />
                </div>
                <button type="submit" disabled={actionLoading} className="btn btn-primary w-full">Save Changes</button>
             </form>
           ) : (
             <div className="p-4 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl">
               <h4 className="font-semibold mb-2">Event Details</h4>
               <p className="text-[var(--color-text-primary)] whitespace-pre-wrap">{event.description || 'No description provided.'}</p>
             </div>
           )}
        </div>

        {isCreator && (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
             <h3 className="text-xl font-bold mb-4">Manage Organizers</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-4">
                 <h4 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase">Add / Edit Organizer</h4>
                 <form onSubmit={handleAddOrganizer} className="bg-[var(--color-bg-primary)] p-4 border border-[var(--color-border)] rounded-xl space-y-4">
                   <div>
                     <label className="block text-sm mb-2">Search User</label>
                     <input type="text" value={searchOrgQuery} onChange={handleSearchOrgs} placeholder="Search by name/email..." className="w-full text-sm" />
                     {searchOrgResults.length > 0 && (
                       <div className="mt-2 text-sm bg-[var(--color-bg-card)] rounded-lg border border-[var(--color-border)] max-h-32 overflow-y-auto">
                         {searchOrgResults.map(u => (
                           <div key={u.id} onClick={() => { setSelectedOrgId(u.id); setSearchOrgQuery(u.displayName); setSearchOrgResults([]); }} 
                                className="p-2 hover:bg-[var(--color-bg-secondary)] cursor-pointer break-all">
                             {u.displayName} ({u.email})
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                   <div className="space-y-2">
                     <label className="block text-sm font-semibold mb-1">Permissions</label>
                     <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={orgPerms.canEditDetails} onChange={e => setOrgPerms({...orgPerms, canEditDetails: e.target.checked})} className="rounded text-[var(--color-accent)]" /> Edit Details</label>
                     <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={orgPerms.canChangeTiming} onChange={e => setOrgPerms({...orgPerms, canChangeTiming: e.target.checked})} className="rounded text-[var(--color-accent)]" /> Change Timing</label>
                     <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={orgPerms.canChangeDurationWhileRunning} onChange={e => setOrgPerms({...orgPerms, canChangeDurationWhileRunning: e.target.checked})} className="rounded text-[var(--color-accent)]" /> Change Duration (Running)</label>
                     <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={orgPerms.canChangePenalty} onChange={e => setOrgPerms({...orgPerms, canChangePenalty: e.target.checked})} className="rounded text-[var(--color-accent)]" /> Change Penalty</label>
                   </div>
                   <button type="submit" disabled={!selectedOrgId || actionLoading} className="btn btn-primary w-full text-sm">Update Permissions</button>
                 </form>
               </div>
               
               <div>
                  <h4 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase mb-4">Current Organizers</h4>
                  {event.organizers?.length > 0 ? (
                    <div className="space-y-3">
                      {event.organizers.map(org => (
                        <div key={org.id} className="p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img src={org.user.avatarUrl || '/default-avatar.png'} className="w-8 h-8 rounded-full" />
                            <div>
                              <div className="font-bold text-sm">{org.user.displayName}</div>
                              <div className="text-xs text-[var(--color-text-secondary)]">
                                {[
                                  org.permissions?.canEditDetails && 'Edit',
                                  org.permissions?.canChangeTiming && 'Timing',
                                  org.permissions?.canChangeDurationWhileRunning && 'Duration',
                                  org.permissions?.canChangePenalty && 'Penalty'
                                ].filter(Boolean).join(', ') || 'No specific rights'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-text-muted)] italic">No organizers appointed yet.</div>
                  )}
               </div>
             </div>
          </div>
        )}

        {event.isTeamEvent && (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-bold mb-4">Team Details</h3>
            {!isUpcoming && <div className="mb-4 text-sm font-semibold text-[var(--color-warning)]">Team formation is closed. The event has started.</div>}
            
            {message && <div className="text-sm font-semibold mb-4 text-[var(--color-accent)]">{message}</div>}

            {userTeam ? (
              <div className="space-y-4">
                <div className="p-5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-2xl">{userTeam.name}</h4>
                      <p className="text-[var(--color-text-secondary)] text-sm">
                        Leader: <span className="text-[var(--color-text-primary)] font-medium">{userTeam.leader.displayName}</span>
                      </p>
                    </div>
                  </div>
                  
                  <h5 className="font-semibold text-sm mb-3">
                    Members <span className="font-normal text-[var(--color-text-secondary)]">({userTeam.members.length} enrolled — Min {event.minTeamSize} / Max {event.maxTeamSize})</span>:
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {userTeam.members.map(m => (
                      <div key={m.userId} className="flex items-center gap-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3 rounded-xl">
                        <img src={m.user.avatarUrl || '/default-avatar.png'} alt={m.user.displayName} className="w-8 h-8 rounded-full" />
                        <span className="font-medium text-sm">{m.user.displayName}</span>
                      </div>
                    ))}
                  </div>

                  {(userTeam.invites?.filter(i => i.status === 'pending').length > 0) && (
                    <div className="mb-4 pt-4 border-t border-[var(--color-border)]">
                       <h5 className="font-semibold text-xs text-[var(--color-text-secondary)] uppercase mb-2">Pending Invites</h5>
                       <ul className="space-y-2">
                         {userTeam.invites.filter(i => i.status === 'pending').map(inv => (
                           <li key={inv.id} className="flex items-center justify-between text-sm bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 rounded-lg">
                             <div className="flex items-center gap-2">
                               <img src={inv.invitedUser.avatarUrl || '/default-avatar.png'} className="w-5 h-5 rounded-full" />
                               <span className="text-[var(--color-text-primary)] font-medium">{inv.invitedUser.displayName}</span>
                             </div>
                             <span className="text-xs text-[var(--color-text-muted)] italic">Waiting...</span>
                           </li>
                         ))}
                       </ul>
                    </div>
                  )}

                  {isUpcoming && userTeam.leaderId === user.id && userTeam.members.length < event.maxTeamSize && (
                    <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                      <h5 className="font-semibold text-sm mb-3">Invite New Members</h5>
                      <input 
                        type="text" 
                        value={searchQuery} 
                        onChange={handleSearchUsers} 
                        placeholder="Search users to invite by name or email..." 
                        className="w-full text-sm mb-3 bg-[var(--color-bg-card)]" 
                      />
                      {searchResults.length > 0 ? (
                        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-2 max-h-48 overflow-y-auto">
                          {searchResults.filter(u => !userTeam.members.some(m => m.userId === u.id)).map(u => (
                            <div key={u.id} className="flex items-center justify-between p-3 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors">
                              <div className="flex items-center gap-3">
                                <img src={u.avatarUrl || '/default-avatar.png'} className="w-8 h-8 rounded-full" />
                                <div>
                                  <div className="font-medium text-sm">{u.displayName}</div>
                                  <div className="text-xs text-[var(--color-text-muted)]">{u.username || u.email}</div>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleInvite(userTeam.id, u.id)} 
                                disabled={actionLoading}
                                className="text-xs btn btn-secondary px-3 py-1.5"
                              >
                                Invite to Team
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : searchQuery.length > 1 ? (
                        <p className="text-sm text-[var(--color-text-muted)] pl-1">No matching users found capable of being invited.</p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingInvites.length > 0 && (
                  <div className="p-5 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-xl shadow-sm">
                    <h5 className="font-bold text-lg mb-4 text-[var(--color-accent)]">You Have Pending Invites!</h5>
                    <div className="space-y-3">
                       {pendingInvites.map(invite => {
                         const targetTeam = teams.find(t => t.id === invite.teamId);
                         return (
                           <div key={invite.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-[var(--color-bg-primary)] border border-[var(--color-accent)]/20 p-4 rounded-xl gap-4">
                             <div className="text-sm">
                               <div className="font-bold text-base mb-1">{targetTeam?.name}</div>
                               <div className="text-[var(--color-text-secondary)]">Invited by <strong>{invite.invitedBy?.displayName || 'Team Leader'}</strong></div>
                             </div>
                             <div className="flex gap-2 shrink-0">
                               <button 
                                 onClick={() => handleInviteAction(invite.id, 'accept')}
                                 disabled={actionLoading}
                                 className="btn btn-primary text-sm px-4 py-2"
                               >
                                 Accept Invite
                               </button>
                               <button 
                                 onClick={() => handleInviteAction(invite.id, 'reject')}
                                 disabled={actionLoading}
                                 className="btn btn-secondary text-[var(--color-danger)] text-sm px-4 py-2"
                               >
                                 Reject
                               </button>
                             </div>
                           </div>
                         );
                       })}
                    </div>
                  </div>
                )}
                
                <div className="p-6 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-primary)] shadow-sm">
                  <h4 className="font-bold text-lg mb-1">Create a New Team</h4>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">Start your own team to compete in this event and invite up to {event.maxTeamSize - 1} other members.</p>
                  <form onSubmit={handleCreateTeam} className="flex gap-3">
                    <input 
                      type="text" 
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Enter a unique team name..."
                      className="flex-1 text-sm bg-[var(--color-bg-card)]"
                      required
                    />
                    <button type="submit" disabled={actionLoading || !teamName.trim()} className="btn btn-primary px-6">
                      Create Team
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
