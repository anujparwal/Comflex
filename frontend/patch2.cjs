const fs = require('fs');
let content = fs.readFileSync('src/pages/EventDetailsPage.jsx', 'utf8');

const newS = `
        {/* LEADERBOARD SECTION */}
        {event.isTeamEvent && (isOngoing || isCompleted) && (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm mt-6">
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
        )}
      </div>
    </Layout>
  );
}
`;

content = content.replace(/      <\/div>\s*<\/Layout>\s*\);\s*}\s*$/, newS);

const headerRegex = /<p className="text-sm text-\[var\(--color-text-secondary\)\] mb-6">\s*\{new Date\(event\.startDate\)\.toLocaleString\(\)\}\s*•\s*\{event\.category\}\s*<\/p>/m;

const newHeader = `<p className="text-sm text-[var(--color-text-secondary)] mb-6">
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
           
content = content.replace(headerRegex, newHeader);

fs.writeFileSync('src/pages/EventDetailsPage.jsx', content);
console.log('patched');
