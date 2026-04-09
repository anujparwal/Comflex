const fs = require('fs');
let content = fs.readFileSync('src/pages/EventDetailsPage.jsx', 'utf8');

const regex = /<h5 className="font-bold text-lg mb-4 text-\[var\(--color-accent\)\]">You Have Pending Invites!<\/h5>\s*>\s*Accept Invite/m;

const replacementStr = `                    <h5 className="font-bold text-lg mb-4 text-[var(--color-accent)]">You Have Pending Invites!</h5>
                    <div className="space-y-3">
                       {pendingInvites.map(invite => {
                         const targetTeam = teams.find(t => t.id === invite.teamId);
                         return (
                           <div key={invite.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-[var(--color-bg-primary)] border border-[var(--color-accent)]/20 p-4 rounded-xl gap-4">
                             <div className="text-sm">
                               <div className="font-bold text-base mb-1">{targetTeam?.name}</div>
                               <div className="text-[var(--color-text-secondary)]">Invited by <strong>{targetTeam?.leader?.displayName || 'Team Leader'}</strong></div>
                               {targetTeam?.members?.length > 0 && (
                                 <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                                   <span className="font-semibold">Current Members:</span> {targetTeam.members.map(m => m.user.displayName).join(', ')}
                                 </div>
                               )}
                             </div>
                             <div className="flex gap-2 shrink-0">
                               <button 
                                 onClick={() => handleInviteAction(invite.id, 'accept')}
                                 disabled={actionLoading}
                                 className="btn btn-primary text-sm px-4 py-2"
                               >
                                 Accept Invite`;

if (regex.test(content)) {
  content = content.replace(regex, replacementStr);
  fs.writeFileSync('src/pages/EventDetailsPage.jsx', content);
  console.log('patched');
} else {
  console.log('string not found');
}
