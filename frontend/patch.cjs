const fs = require('fs');

let content = fs.readFileSync('src/pages/EventDetailsPage.jsx', 'utf8');

// Add CountdownClock component
content = content.replace(
  "export default function EventDetailsPage() {",
  `const CountdownClock = ({ targetDate, label }) => {
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

export default function EventDetailsPage() {`
);

// Add leaderboard state
content = content.replace(
  "const [message, setMessage] = useState('');",
  `const [message, setMessage] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);`
);

// Helper state constants
content = content.replace(
  "const isOrganizer = isCreator || event.organizers?.some(o => o.userId === user.id);",
  `const isOrganizer = isCreator || event.organizers?.some(o => o.userId === user.id);
  
  const now = new Date();
  const start = new Date(event.startDate);
  const end = new Date(start.getTime() + (event.durationHours * 3600000) + (event.durationMinutes * 60000));
  
  const isOngoing = event.status === 'ongoing' || (event.status !== 'completed' && event.autoStart && now >= start && now < end);
  const isCompleted = event.status === 'completed' || (event.status !== 'ongoing' && event.autoStart && now >= end);
  const isUpcoming = !isOngoing && !isCompleted;`
);

// Add Leaderboard Fetching & Manual Status effects
content = content.replace(
  "fetchEventData();\n  }, [fetchEventData]);",
  `fetchEventData();
  }, [fetchEventData]);

  const fetchLeaderboardData = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await eventApi.getLeaderboard(id);
      setLeaderboard(data.data);
    } catch (e) {
      // Ignore
    }
  }, [id]);

  useEffect(() => {
    if (event && event.isTeamEvent && (isOngoing || isCompleted)) {
      fetchLeaderboardData();
      if (isOngoing) {
        const t = setInterval(fetchLeaderboardData, 5000);
        return () => clearInterval(t);
      }
    }
  }, [event, isOngoing, isCompleted, fetchLeaderboardData]);

  const handleForceState = async (newState) => {
    if (!confirm(\`Are you sure you want to manually mark this event as \${newState}?\`)) return;
    setActionLoading(true);
    try {
      const payload = { status: newState };
      if (newState === 'ongoing') {
        payload.startDate = new Date().toISOString(); 
      }
      await eventApi.updateEvent(id, payload);
      setMessage(\`Event marked as \${newState}.\`);
      fetchEventData();
    } catch (err) {
      setMessage(err.response?.data?.error?.message || 'Failed to change state.');
    } finally {
      setActionLoading(false);
    }
  };`
);


// Replace header with Timer and Buttons
const headerBlockOrig = `<h2 className="text-3xl font-bold gradient-text">{event.title}</h2>
             {isOrganizer && (
               <button onClick={() => setIsEditing(!isEditing)} className="btn btn-secondary text-sm px-3 py-1.5">
                 {isEditing ? 'Cancel Edit' : 'Edit Details'}
               </button>
             )}
           </div>
           <p className="text-sm text-[var(--color-text-secondary)] mb-6">
             {new Date(event.startDate).toLocaleString()} • {event.category}
           </p>`;

const headerBlockNew = `<h2 className="text-3xl font-bold gradient-text">{event.title}</h2>
             {isOrganizer && (
               <button onClick={() => setIsEditing(!isEditing)} className="btn btn-secondary text-sm px-3 py-1.5">
                 {isEditing ? 'Cancel Edit' : 'Edit Details'}
               </button>
             )}
           </div>
           <p className="text-sm text-[var(--color-text-secondary)] mb-6">
             {new Date(event.startDate).toLocaleString()} • {event.category}
           </p>

           <div className="flex flex-col md:flex-row gap-6 mb-8 mt-4 justify-between items-start md:items-center">
             {isUpcoming && <CountdownClock targetDate={start} label="Time until Start" />}
             {isOngoing && <CountdownClock targetDate={end} label="Time Remaining" />}
             {isCompleted && <div className="text-xl font-bold text-[var(--color-text-muted)] py-4">Event has Ended.</div>}

             {isOrganizer && (
               <div className="flex gap-2">
                 {(isUpcoming || isOngoing) && (
                    <button onClick={() => handleForceState(isUpcoming ? 'ongoing' : 'completed')} disabled={actionLoading} className="btn btn-primary">
                      {isUpcoming ? 'Force Start Event' : 'End Event Early'}
                    </button>
                 )}
               </div>
             )}
           </div>`;
content = content.replace(headerBlockOrig, headerBlockNew);

// Replace Team Rendering Logic wrapper
const teamRegistrationHeader = `<h3 className="text-xl font-bold mb-4">Team Registration</h3>`;
const teamRegistrationHeaderNew = `<h3 className="text-xl font-bold mb-4">Team Details</h3>
            {!isUpcoming && <div className="mb-4 text-sm font-semibold text-[var(--color-warning)]">Team formation is closed. The event has started.</div>}`;
content = content.replace(teamRegistrationHeader, teamRegistrationHeaderNew);

const inviteMembersWrapper = `{userTeam.leaderId === user.id && userTeam.members.length < event.maxTeamSize && (`;
const inviteMembersWrapperNew = `{isUpcoming && userTeam.leaderId === user.id && userTeam.members.length < event.maxTeamSize && (`;
content = content.replace(inviteMembersWrapper, inviteMembersWrapperNew);

const createTeamWrapper = `<div className="p-6 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-primary)] shadow-sm">
                  <h4 className="font-bold text-lg mb-1">Create a New Team</h4>`;
const createTeamWrapperNew = `{isUpcoming && (<div className="p-6 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-primary)] shadow-sm">
                  <h4 className="font-bold text-lg mb-1">Create a New Team</h4>`;
content = content.replace(createTeamWrapper, createTeamWrapperNew);

const createTeamEndWrapper = `</form>
                </div>
              </div>
            )}
          </div>
        )}`;
const createTeamEndWrapperNew = `</form>
                </div>)}
              </div>
            )}
          </div>
        )}
        
        {/* LEADERBOARD SECTION */}
        {event.isTeamEvent && (isOngoing || isCompleted) && (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-bold mb-4 gradient-text">Live Leaderboard</h3>
            {leaderboard.length === 0 ? (
              <p className="text-[var(--color-text-secondary)] italic">No scoreboard data available yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
                      <th className="p-3">Rank</th>
                      <th className="p-3">Team</th>
                      <th className="p-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((t, i) => (
                      <tr key={t.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-primary)] transition-colors">
                        <td className="p-3 font-bold">#{i + 1}</td>
                        <td className="p-3">{t.name}</td>
                        <td className="p-3 text-right font-mono font-bold text-[var(--color-accent)]">{t.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}`;
content = content.replace(createTeamEndWrapper, createTeamEndWrapperNew);

fs.writeFileSync('src/pages/EventDetailsPage.jsx', content);
console.log('Done replacing!');
