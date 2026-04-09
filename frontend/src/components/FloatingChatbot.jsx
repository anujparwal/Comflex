import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Paperclip, FileText, UploadCloud, Trash2, Search, ChevronLeft } from 'lucide-react';
import api from '../api/client';
import { resourceApi } from '../api/resourceApi';
import { useAuth } from '../hooks/useAuth';
import '../index.css';

export default function FloatingChatbot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [limits, setLimits] = useState(null);
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchLimits();
      fetchNotes();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchLimits = async () => {
    try {
      const res = await api.get('/chatbot/limits');
      setLimits(res.data.data);
    } catch (err) {
      console.error('Failed to fetch limits', err);
    }
  };

  const fetchNotes = async () => {
    try {
      const res = await api.get('/chatbot');
      setNotes(res.data.data);
      if (res.data.data.length > 0 && !selectedNoteId) {
        setSelectedNoteId(res.data.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch notes', err);
    }
  };

  const handleLocalUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (limits?.plan !== 'ultra') {
      alert('Local uploads are only available on the Ultra plan.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      await api.post('/chatbot/upload/local', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchLimits();
      fetchNotes();
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResourceUpload = async (resourceId) => {
    setShowResourcePicker(false);
    if (!resourceId) return;

    setLoading(true);
    try {
      await api.post('/chatbot/upload/resource', { resourceId });
      fetchLimits();
      fetchNotes();
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || 'Upload failed';
      alert(typeof msg === 'object' ? JSON.stringify(msg) : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await api.delete(`/chatbot/${id}`);
      if (selectedNoteId === id) setSelectedNoteId(null);
      fetchLimits();
      fetchNotes();
    } catch (err) {
      alert('Delete failed');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedNoteId) return;

    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/chatbot/chat', {
        noteId: selectedNoteId,
        query: userMsg.text
      });
      
      setMessages(prev => [...prev, { role: 'bot', text: res.data.data.answer }]);
      
      // Update tokens if we got info back and we are free tier
      if (limits?.plan === 'free') {
        setLimits(prev => ({ ...prev, dailyChatTokens: res.data.data.remainingTokens }));
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || 'Error contacting AI.';
      setMessages(prev => [...prev, { role: 'bot', text: typeof msg === 'object' ? JSON.stringify(msg) : msg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user) return null;

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 transition"
      >
        <MessageCircle size={28} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-4rem)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 z-50 transition-all">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <div>
          <h3 className="font-bold">Notes Chatbot</h3>
          {limits && (
            <p className="text-xs text-blue-100">
              Plan: <span className="uppercase font-semibold">{limits.plan}</span>
              {limits.plan === 'free' && ` | Tokens: ${limits.dailyChatTokens}`}
            </p>
          )}
        </div>
        <button onClick={() => setIsOpen(false)} className="hover:bg-blue-700 p-1 rounded">
           <X size={20} />
        </button>
      </div>

      {/* Note Selection Area */}
      <div className="p-3 border-b bg-gray-50 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-semibold text-gray-500 uppercase">Notes:</span>
        {notes.map(n => (
          <button 
            key={n.id} 
            onClick={() => setSelectedNoteId(n.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap ${selectedNoteId === n.id ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}
          >
            <FileText size={12} />
            {n.title.substring(0, 15)}...
            <Trash2 size={12} className="ml-1 text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); handleDeleteNote(n.id); }} />
          </button>
        ))}
        {/* Upload Buttons */}
        <button 
          title="Import from Resources"
          onClick={() => setShowResourcePicker(true)}
          disabled={loading}
          className="p-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50"
        >
           <UploadCloud size={14} />
        </button>

        {limits?.plan === 'ultra' && (
           <label className="p-1.5 rounded bg-purple-100 hover:bg-purple-200 text-purple-700 cursor-pointer disabled:opacity-50 flex items-center">
             <Paperclip size={14} />
             <input type="file" className="hidden" onChange={handleLocalUpload} />
           </label>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3">
        {messages.length === 0 && (
           <div className="text-center text-gray-400 mt-10">
             {notes.length === 0 ? "Please upload notes above first." : "Ask anything about your notes!"}
           </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-xl max-w-[85%] text-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border rounded-bl-none text-gray-800'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
             <div className="p-3 rounded-xl bg-gray-200 animate-pulse text-sm">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t flex gap-2">
        <textarea
           value={input}
           onChange={e => setInput(e.target.value)}
           onKeyDown={handleKeyDown}
           disabled={loading || notes.length === 0}
           placeholder={notes.length === 0 ? 'Upload notes to chat...' : 'Ask a question...'}
           className="flex-1 bg-gray-100 border-none rounded-lg resize-none h-10 p-2 text-sm focus:ring-0"
           rows={1}
        />
        <button 
          onClick={sendMessage} 
          disabled={loading || !input.trim() || notes.length === 0}
          className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>

      {showResourcePicker && (
        <ResourcePickerModal
          onClose={() => setShowResourcePicker(false)}
          onSelect={handleResourceUpload}
        />
      )}
    </div>
  );
}

function ResourcePickerModal({ onClose, onSelect }) {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  let myYear = 29;
  if (user?.cohortTags) {
    for (const tag of user.cohortTags) {
      if (tag.startsWith('cohort-') && !tag.includes('-', 7)) {
        const p = parseInt(tag.split('-')[1], 10);
        if (p) myYear = p;
      }
    }
  }

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const res = await resourceApi.getSubjects({}); 
      let allSubs = res.data.data;
      if (user?.globalRing !== 0) {
        allSubs = allSubs.filter(s => {
          if (s.name === 'Technical' || s.category === 'Technical') return true;
          if (s.subCategory === `Batch ${myYear}` || s.subCategory === `Batch ${myYear + 1}`) return true;
          return false;
        });
      }
      setSubjects(allSubs);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async (subject) => {
    setSelectedSubject(subject);
    setLoading(true);
    try {
      const res = await resourceApi.getResources(subject.id);
      setResources(res.data.data);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-white/95 backdrop-blur z-20 flex flex-col p-4 animate-fade-in">
       <div className="flex justify-between items-center mb-4">
         {selectedSubject ? (
            <button onClick={() => setSelectedSubject(null)} className="flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800">
              <ChevronLeft size={16} /> Back to Folders
            </button>
         ) : (
            <h3 className="font-bold">Select Resource</h3>
         )}
         <button onClick={onClose}><X size={20}/></button>
       </div>

       <div className="flex-1 overflow-y-auto space-y-2">
         {loading ? (
             <div className="text-center py-10 text-gray-400 text-sm">Loading...</div>
         ) : selectedSubject ? (
            resources.length === 0 ? <p className="text-sm text-gray-500 text-center mt-4">Empty folder.</p> :
            resources.map(r => (
               <div key={r.id} onClick={() => onSelect(r.id)} className="p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer flex gap-3 items-center">
                 <FileText size={24} className="text-blue-500" />
                 <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{r.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{(r.fileSize / 1048576).toFixed(2)} MB</p>
                 </div>
               </div>
            ))
         ) : (
            subjects.length === 0 ? <p className="text-sm text-gray-500 text-center mt-4">No subjects found.</p> :
            subjects.map(s => (
               <div key={s.id} onClick={() => fetchResources(s)} className="p-3 bg-gray-50 border rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer flex gap-3 items-center">
                 <span className="text-2xl">📁</span>
                 <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    {s.subCategory && <p className="text-[10px] text-gray-500 uppercase">{s.category} • {s.subCategory}</p>}
                 </div>
               </div>
            ))
         )}
       </div>
    </div>
  );
}
