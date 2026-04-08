import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { eventApi } from '../api/eventApi';

export default function EventDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventApi.getEvent(id)
      .then(res => setEvent(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <Layout><div className="p-8">Loading event...</div></Layout>;
  }

  if (!event) {
    return <Layout><div className="p-8">Event not found.</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-2 gradient-text">{event.title}</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          {new Date(event.startDate).toLocaleString()} • {event.category}
        </p>
        
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm mb-6">
           <p className="text-[var(--color-text-primary)]">{event.description}</p>
        </div>

        {event.isTeamEvent && (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm mb-6">
            <h3 className="text-xl font-bold mb-4">Teams</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">Team formation and invites go here.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
