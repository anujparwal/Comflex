import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { eventApi } from '../api/eventApi';
import { userApi } from '../api/userApi';

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

  const fetchEventData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: eventRes } = await eventApi.getEvent(id);
      setEvent(eventRes.data);
      
      if (eventRes.data.isTeamEvent) {
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

  if (loading) {
    return <Layout><div className="p-8">Loading event...</div></Layout>;
  }

  if (!event) {
    return <Layout><div className="p-8">Event not found.</div></Layout>;
  }

  const userTeam = teams.find(t => t.members.some(m => m.userId === user.id));
  const pendingInvites = teams.flatMap(t => t.invites || []).filter(i => i.invitedUserId === user.id && i.status === 'pending');

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8 shadow-sm">
           <h2 className="text-3xl font-bold mb-2 gradient-text">{event.title}</h2>
           <p className="text-sm text-[var(--color-text-secondary)] mb-6">
             {new Date(event.startDate).toLocaleString()} • {event.category}
           </p>
           
           <div className="p-4 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl">
             <h4 className="font-semibold mb-2">Event Details</h4>
             <p className="text-[var(--color-text-primary)] whitespace-pre-wrap">{event.description || 'No description provided.'}</p>
           </div>
        </div>

        {event.isTeamEvent && (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-bold mb-4">Team Registration</h3>
            
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
                  
                  <h5 className="font-semibold text-sm mb-3">Members ({userTeam.members.length}/{event.maxTeamSize}):</h5>
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

                  {userTeam.leaderId === user.id && userTeam.members.length < event.maxTeamSize && (
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
