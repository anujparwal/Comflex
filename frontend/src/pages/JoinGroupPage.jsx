import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function JoinGroupPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('joining'); // joining, success, error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const joinGroup = async () => {
      try {
        const { data } = await client.post(`/groups/join/${token}`);
        setStatus('success');
        setTimeout(() => {
          navigate(`/groups/${data.data.group.id}`);
        }, 1500);
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.response?.data?.error?.message || 'Failed to join group. Link may be invalid or expired.');
      }
    };
    joinGroup();
  }, [token, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-800">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 max-w-md w-full text-center tracking-tight">
        {status === 'joining' && (
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Joining Group...</h2>
            <p className="text-gray-500 mt-2 text-sm">Please wait while we process your invite.</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-4 text-3xl shadow-sm border border-green-200">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Successfully Joined!</h2>
            <p className="text-gray-500 mt-2 text-sm">Redirecting to the group chat...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4 text-3xl shadow-sm border border-red-200">
              !
            </div>
            <h2 className="text-xl font-bold text-gray-900">Oops, something went wrong</h2>
            <p className="text-red-500 mt-3 text-sm font-medium bg-red-50 p-2 rounded w-full border border-red-100">{errorMsg}</p>
            <button 
              onClick={() => navigate('/groups')}
              className="mt-6 px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-md hover:shadow-lg font-medium text-sm w-full"
            >
              Go to My Groups
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
