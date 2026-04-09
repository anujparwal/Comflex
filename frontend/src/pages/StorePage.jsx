import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { storeApi } from '../api/storeApi';

export default function StorePage() {
  const { user, refreshProfile } = useAuth();
  const [listings, setListings] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [ledger, setLedger] = useState({ balance: 0, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('store'); // store, inventory, ledger, (admin)

  // Admin form specific
  const [badgeForm, setBadgeForm] = useState({ name: '', description: '', imageUrl: '', isEventBadge: false });
  const [badgeImage, setBadgeImage] = useState(null);
  const [listingForm, setListingForm] = useState({ badgeId: '', price: 0, quantity: -1 });
  const [mintForm, setMintForm] = useState({ userId: '', amount: 100 });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'store' || activeTab === 'admin') {
        const res = await storeApi.getListings();
        setListings(res.data.data);
      }
      if (activeTab === 'admin') {
        const bRes = await storeApi.getAllBadges();
        setAllBadges(bRes.data.data);
      }
      if (activeTab === 'inventory') {
        const res = await storeApi.getInventory();
        setInventory(res.data.data);
      } else if (activeTab === 'ledger') {
        const res = await storeApi.getLedger();
        setLedger(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (listingId) => {
    try {
      await storeApi.purchaseBadge(listingId);
      // alert('Purchase successful!');
      fetchData();
      refreshProfile(); // to update credits
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Purchase failed');
    }
  };

  const handleCreateBadge = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', badgeForm.name);
      formData.append('description', badgeForm.description);
      formData.append('isEventBadge', badgeForm.isEventBadge);
      if (badgeForm.imageUrl) formData.append('imageUrl', badgeForm.imageUrl);
      if (badgeImage) formData.append('image', badgeImage);

      await storeApi.adminCreateBadge(formData);
      setBadgeForm({ name: '', description: '', imageUrl: '', isEventBadge: false });
      setBadgeImage(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Creation failed');
    }
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    try {
      await storeApi.adminCreateListing({
        badgeId: listingForm.badgeId,
        price: parseInt(listingForm.price, 10),
        quantity: parseInt(listingForm.quantity, 10)
      });
      alert('Listing created');
      setListingForm({ badgeId: '', price: 0, quantity: -1 });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Creation failed');
    }
  };

  const handleMintCredits = async (e) => {
    e.preventDefault();
    try {
      await storeApi.mintCredits(mintForm.userId, parseInt(mintForm.amount, 10));
      setMintForm({ userId: '', amount: 100 });
      fetchData();
      alert('Credits successfully minted!');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Mint failed');
    }
  };

  const isAdmin = user?.globalRing === 0 || user?.canManageStore;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto fade-in">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">🛒 Web3 Store & Ledger</h1>
          <div className="flex items-center gap-4">
            <span className="font-semibold text-[var(--color-primary)]">
              🪙 Credits: {user?.creditBalance ?? 0}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 sticky top-0 bg-[var(--color-bg-primary)] z-10 py-2">
          <button onClick={() => setActiveTab('store')} className={`btn ${activeTab === 'store' ? 'btn-primary' : 'btn-secondary'}`}>Badges Store</button>
          <button onClick={() => setActiveTab('inventory')} className={`btn ${activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}>My Inventory</button>
          <button onClick={() => setActiveTab('ledger')} className={`btn ${activeTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}>Ledger History</button>
          {isAdmin && (
            <button onClick={() => setActiveTab('admin')} className={`btn ${activeTab === 'admin' ? 'bg-[var(--color-danger)] text-white' : 'btn-secondary'}`}>⚙️ Admin</button>
          )}
        </div>

        {loading ? (
           <div className="skeleton h-64 w-full rounded-xl" />
        ) : (
          <>
            {activeTab === 'store' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {listings.length === 0 ? <p className="text-[var(--color-text-muted)] col-span-3">No active listings.</p> : null}
                {listings.map(l => (
                  <div key={l.id} className="glass-card p-4 flex flex-col items-center hover:scale-105 transition-transform duration-300">
                    <img src={l.badge.imageUrl} alt={l.badge.name} className="w-24 h-24 mb-4 object-cover drop-shadow-lg" />
                    <h3 className="font-bold text-lg mb-1">{l.badge.name}</h3>
                    <p className="text-xs text-[var(--color-text-muted)] text-center mb-4">{l.badge.description}</p>
                    <div className="mt-auto flex w-full items-center justify-between">
                      <span className="font-bold text-[var(--color-primary)]">🪙 {l.price}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{l.quantity === -1 ? '∞' : `${l.quantity - l.sold} left`}</span>
                    </div>
                    <button 
                      onClick={() => handlePurchase(l.id)} 
                      disabled={user?.creditBalance < l.price || (l.quantity !== -1 && l.sold >= l.quantity)}
                      className="btn btn-primary w-full mt-4"
                    >
                      {l.quantity !== -1 && l.sold >= l.quantity ? 'Sold Out' : 'Buy Now'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                 {inventory.length === 0 ? <p className="text-[var(--color-text-muted)] col-span-3">You don't own any badges yet.</p> : null}
                 {inventory.map(inv => (
                   <div key={inv.id} className="glass-card p-4 flex flex-col items-center">
                     <img src={inv.badge.imageUrl} alt={inv.badge.name} className="w-16 h-16 mb-2 object-cover drop-shadow-md" />
                     <h4 className="font-bold text-sm text-center">{inv.badge.name}</h4>
                     <span className="text-[10px] text-[var(--color-text-muted)] mt-2 italic bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded">Source: {inv.source}</span>
                   </div>
                 ))}
                 <div className="col-span-full mt-4 p-4 border border-[var(--color-accent)] rounded-lg bg-[var(--color-accent)]/10">
                   <p className="text-sm font-semibold text-[var(--color-accent)]">💡 Want to show these off?</p>
                   <p className="text-xs text-[var(--color-text-secondary)] mt-1">Go to your <a href="/profile" className="underline font-bold">Profile</a> to equip up to 5 badges to display next to your name in chats!</p>
                 </div>
              </div>
            )}

            {activeTab === 'ledger' && (
              <div className="glass-card p-0 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
                    <tr>
                      <th className="p-4 font-semibold border-b border-[var(--color-border)]">Date</th>
                      <th className="p-4 font-semibold border-b border-[var(--color-border)]">Type</th>
                      <th className="p-4 font-semibold border-b border-[var(--color-border)]">Amount</th>
                      <th className="p-4 font-semibold border-b border-[var(--color-border)]">From / To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.transactions.length === 0 && <tr><td colSpan="4" className="p-4 text-center text-[var(--color-text-muted)]">No transactions found.</td></tr>}
                    {ledger.transactions.map((tx) => {
                      const isSender = tx.senderId === user?.id;
                      return (
                        <tr key={tx.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]/50">
                          <td className="p-4">{new Date(tx.createdAt).toLocaleString()}</td>
                          <td className="p-4 capitalize">{tx.type.replace('_', ' ')}</td>
                          <td className="p-4 font-bold">
                            <span className={isSender ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}>
                              {isSender ? '-' : '+'}🪙 {tx.amount}
                            </span>
                          </td>
                          <td className="p-4 text-[var(--color-text-secondary)]">
                            {tx.type === 'purchase' ? 'Store' 
                             : tx.type === 'download_reward' ? 'System Reward'
                             : tx.type === 'event_reward' ? 'Event Reward'
                             : isSender ? `To ${tx.receiver?.displayName}` 
                             : `From ${tx.sender?.displayName || 'System'}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'admin' && isAdmin && (
              <div className="space-y-8">
                <div className="glass-card p-6">
                  <h2 className="text-xl font-bold mb-4">Create New Badge</h2>
                  <form onSubmit={handleCreateBadge} className="space-y-4 max-w-md">
                    <input type="text" placeholder="Badge Name" required className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-2 rounded focus:outline-[var(--color-accent)]" 
                      value={badgeForm.name} onChange={e => setBadgeForm({...badgeForm, name: e.target.value})} />
                    <input type="file" accept="image/*" onChange={e => setBadgeImage(e.target.files[0])} className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-2 rounded focus:outline-[var(--color-accent)]" />
                    <p className="text-xs text-center text-[var(--color-text-muted)]">- OR -</p>
                    <input type="text" placeholder="Upload via Image URL instead" className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-2 rounded focus:outline-[var(--color-accent)]" 
                      value={badgeForm.imageUrl} onChange={e => setBadgeForm({...badgeForm, imageUrl: e.target.value})} />
                    <textarea placeholder="Description" required className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-2 rounded focus:outline-[var(--color-accent)]" 
                      value={badgeForm.description} onChange={e => setBadgeForm({...badgeForm, description: e.target.value})} />
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <input type="checkbox" checked={badgeForm.isEventBadge} onChange={e => setBadgeForm({...badgeForm, isEventBadge: e.target.checked})} />
                      Event Badge (Cannot be sold in store)
                    </label>
                    <button type="submit" className="btn btn-primary w-full">Create Badge</button>
                  </form>
                </div>
                
                <div className="glass-card p-6">
                  <h2 className="text-xl font-bold mb-4">Create Store Listing</h2>
                  <form onSubmit={handleCreateListing} className="space-y-4 max-w-md">
                    <input type="text" placeholder="Badge ID" required className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-2 rounded focus:outline-[var(--color-accent)]" 
                      value={listingForm.badgeId} onChange={e => setListingForm({...listingForm, badgeId: e.target.value})} />
                    <input type="number" placeholder="Price (Credits)" min="0" required className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-2 rounded focus:outline-[var(--color-accent)]" 
                      value={listingForm.price} onChange={e => setListingForm({...listingForm, price: e.target.value})} />
                    <input type="number" placeholder="Quantity (-1 for infinite)" required className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-2 rounded focus:outline-[var(--color-accent)]" 
                      value={listingForm.quantity} onChange={e => setListingForm({...listingForm, quantity: e.target.value})} />
                    <button type="submit" className="btn btn-primary w-full">List on Store</button>
                  </form>
                </div>

                {user?.globalRing === 0 && (
                  <div className="glass-card p-6">
                    <h2 className="text-xl font-bold mb-4">Mint Credits to User</h2>
                    <form onSubmit={handleMintCredits} className="space-y-4 max-w-md">
                      <input type="text" placeholder="User ID" required className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-2 rounded focus:outline-[var(--color-accent)]" 
                        value={mintForm.userId} onChange={e => setMintForm({...mintForm, userId: e.target.value})} />
                      <input type="number" placeholder="Amount" min="1" required className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-2 rounded focus:outline-[var(--color-accent)]" 
                        value={mintForm.amount} onChange={e => setMintForm({...mintForm, amount: e.target.value})} />
                      <button type="submit" className="btn btn-primary w-full text-white bg-[var(--color-success)]">Mint Credits</button>
                    </form>
                  </div>
                )}
                
                <div className="glass-card p-6 border-t border-[var(--color-border)] mt-8">
                  <h2 className="text-xl font-bold mb-4">Badge Database (All Created Badges)</h2>
                  {allBadges.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] italic">No badges have been created yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allBadges.map(b => (
                        <div key={b.id} className="flex flex-col gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-3 rounded-lg overflow-hidden">
                          <div className="flex items-center gap-3">
                            <img src={b.imageUrl} className="w-12 h-12 rounded object-cover" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm truncate">{b.name}</h4>
                              <p className="text-[10px] text-[var(--color-text-muted)] font-mono truncate" title="ID to copy">{b.id}</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                            {b.isEventBadge ? (
                               <span className="text-[10px] bg-[var(--color-accent)]/20 text-[var(--color-accent)] px-2 py-0.5 rounded font-semibold">Event Bound</span>
                            ) : (
                               <span className="text-[10px] bg-[var(--color-success)]/20 text-[var(--color-success)] px-2 py-0.5 rounded font-semibold">Store Ready</span>
                            )}
                            <button onClick={() => { setListingForm({...listingForm, badgeId: b.id}); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="btn btn-secondary text-[10px] px-2 py-1 shrink-0" title="Load into Store Listing form" disabled={b.isEventBadge}>
                              List on Store &uarr;
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
