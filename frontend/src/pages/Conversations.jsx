import { useState, useEffect, useRef } from 'react';
import { Send, Search, CheckCheck, Bot, User, Phone } from 'lucide-react';
import api from '../utils/api';
import { useSocket } from '../hooks/useSocket';
import { formatDistanceToNow, format } from 'date-fns';

const statusColors = { open: 'bg-green-500', pending: 'bg-amber-400', closed: 'bg-gray-300' };

export default function Conversations() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { fetchConversations(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchConversations = async () => {
    const { data } = await api.get('/conversations');
    setConversations(data.data);
  };

  const openConversation = async (conv) => {
    setSelected(conv);
    const { data } = await api.get(`/conversations/${conv._id}`);
    setMessages(data.data.messages);
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await api.post(`/conversations/${selected._id}/reply`, { message: reply });
      setMessages(m => [...m, { direction: 'outbound', content: reply, sentBy: 'human', timestamp: new Date() }]);
      setReply('');
    } finally {
      setSending(false);
    }
  };

  // Real-time socket updates
  useSocket((data) => {
    if (data.conversationId === selected?._id) {
      setMessages(m => [
        ...m,
        { direction: 'inbound', content: data.message.content, timestamp: new Date() },
        { direction: 'outbound', content: data.reply.content, sentBy: 'ai', timestamp: new Date() },
      ]);
    }
    fetchConversations();
  });

  const filtered = conversations.filter(c =>
    c.customerName?.toLowerCase().includes(filter.toLowerCase()) ||
    c.customerPhone.includes(filter)
  );

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 mb-3">Conversations</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={filter} onChange={e => setFilter(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(conv => (
            <button
              key={conv._id}
              onClick={() => openConversation(conv)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected?._id === conv._id ? 'bg-green-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-semibold text-gray-600 text-sm">
                    {(conv.customerName || '?')[0].toUpperCase()}
                  </div>
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${statusColors[conv.status]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-semibold text-gray-900 truncate">{conv.customerName || conv.customerPhone}</p>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{conv.customerPhone}</p>
                </div>
              </div>
            </button>
          ))}
          {!filtered.length && (
            <p className="text-center text-sm text-gray-400 py-8">No conversations</p>
          )}
        </div>
      </div>

      {/* Chat area */}
      {selected ? (
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center font-bold text-green-700">
              {(selected.customerName || '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{selected.customerName || 'Unknown'}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{selected.customerPhone}</p>
            </div>
            <div className="ml-auto flex gap-2">
              {['open', 'pending', 'closed'].map(s => (
                <button key={s}
                  onClick={() => api.patch(`/conversations/${selected._id}/status`, { status: s }).then(fetchConversations)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    selected.status === s ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-500 hover:border-green-400'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                {msg.direction === 'inbound' && (
                  <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center mr-2 flex-shrink-0 self-end">
                    <User size={12} className="text-gray-500" />
                  </div>
                )}
                <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                  msg.direction === 'outbound'
                    ? 'bg-green-500 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                }`}>
                  <p>{msg.content}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 ${msg.direction === 'outbound' ? 'text-green-100' : 'text-gray-400'}`}>
                    <span className="text-xs">{format(new Date(msg.timestamp || Date.now()), 'HH:mm')}</span>
                    {msg.direction === 'outbound' && (
                      msg.sentBy === 'ai'
                        ? <Bot size={10} />
                        : <CheckCheck size={10} />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="bg-white border-t border-gray-100 p-4 flex gap-3">
            <input
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
              placeholder="Type a reply..."
              className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <button
              onClick={sendReply} disabled={sending || !reply.trim()}
              className="w-10 h-10 bg-green-500 hover:bg-green-600 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50">
              <Send size={16} className="text-white" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={28} className="text-green-400" />
            </div>
            <p className="font-semibold text-gray-700">Select a conversation</p>
            <p className="text-sm text-gray-400 mt-1">Click a chat to view messages</p>
          </div>
        </div>
      )}
    </div>
  );
}

// fix missing import
const MessageSquare = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
