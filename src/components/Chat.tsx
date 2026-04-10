import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  User, 
  MessageSquare, 
  X, 
  Loader2,
  ChevronDown
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}

interface ChatProps {
  rescueId: string;
  recipientName: string;
  onClose?: () => void;
}

export default function Chat({ rescueId, recipientName, onClose }: ChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rescueId) return;

    const q = query(
      collection(db, 'rescues', rescueId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      console.error("Chat snapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [rescueId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);
    try {
      await addDoc(collection(db, 'rescues', rescueId, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName || 'User',
        text: newMessage.trim(),
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error("Send message error:", error);
      handleFirestoreError(error, OperationType.CREATE, `rescues/${rescueId}/messages`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Chat with {recipientName}</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Live Support</span>
            </div>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <MessageSquare className="w-8 h-8 text-slate-200" />
            </div>
            <p className="text-slate-400 text-sm">No messages yet. Send a message to start the conversation.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <div 
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${isMe ? 'order-1' : 'order-2'}`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                    isMe 
                      ? 'bg-orange-500 text-white rounded-tr-none shadow-lg shadow-orange-100' 
                      : 'bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                  <div className={`text-[10px] mt-1 text-slate-400 font-medium ${isMe ? 'text-right' : 'text-left'}`}>
                    {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form 
        onSubmit={sendMessage}
        className="p-4 bg-white border-t border-slate-100 flex gap-2"
      >
        <input 
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-orange-500 transition-all"
        />
        <button 
          type="submit"
          disabled={!newMessage.trim() || isSending}
          className="p-3 bg-orange-500 text-white rounded-2xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 disabled:opacity-50 disabled:shadow-none"
        >
          {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
}
