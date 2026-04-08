import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { eventApi } from '../api/eventApi';
import { Link } from 'react-router-dom';

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventApi.listEvents()
      .then(res => setEvents(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 gradient-text">Events</h2>
        
        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-[var(--color-bg-secondary)] animate-pulse rounded-2xl" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm text-center">
            <p className="text-[var(--color-text-secondary)]">No upcoming events targeted for you right now!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map(event => (
              <Link to={`/events/${event.id}`} key={event.id} className="block group">
                <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)] rounded-2xl p-6 shadow-sm transition-colors text-left">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold group-hover:text-[var(--color-accent)] transition-colors">{event.title}</h3>
                    <span className="text-xs font-semibold px-2 py-1 bg-[var(--color-bg-card)] rounded-full border border-[var(--color-border)]">
                      {event.category}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">{new Date(event.startDate).toLocaleString()}</p>
                  
                  {event.isTeamEvent && (
                    <span className="inline-block text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-bg-primary)] px-2 py-1 rounded">
                      Team Event ({event.minTeamSize}-{event.maxTeamSize} members)
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
