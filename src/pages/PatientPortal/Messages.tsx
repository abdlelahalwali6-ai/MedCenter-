/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, where, orderBy, addDoc, serverTimestamp, updateDoc, doc, limit } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { toDate } from '@/src/lib/dateUtils';
import { useAuth } from '@/src/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Search, User, Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function PatientMessages() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // For demo, we assume the patient messages a generic "Support/Doctor" account or we list staff
  const staff = [
    { id: 'admin_support', name: 'الدعم الفني والاداري', role: 'ادارة المركز' },
    { id: 'doc1', name: 'د. فهد الجاسر', role: 'طبيب أسنان' },
    { id: 'doc2', name: 'د. ريم خالد', role: 'طبيب عام' },
  ];
  const [selectedStaff, setSelectedStaff] = useState(staff[0]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'messages'),
      where('senderId', 'in', [user.uid, selectedStaff.id]),
      where('receiverId', 'in', [user.uid, selectedStaff.id]),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
      
      // Mark received messages as read
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.receiverId === user.uid && !data.read) {
          updateDoc(doc(db, 'messages', d.id), { read: true });
        }
      });
    });

    return () => unsubscribe();
  }, [user, selectedStaff]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        senderName: profile?.displayName || 'مريض',
        receiverId: selectedStaff.id,
        receiverName: selectedStaff.name,
        content: newMessage,
        read: false,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      toast.error('فشل إرسال الرسالة');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] gap-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">الرسائل الآمنة</h1>
          <p className="text-muted-foreground">تواصل مع فريقك الطبي بخصوص الاستفسارات غير الطارئة.</p>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Staff List */}
        <Card className="w-80 hidden md:flex flex-col overflow-hidden">
          <CardHeader className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="بحث عن طبيب..." className="pl-10" />
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {staff.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStaff(s)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-right ${selectedStaff.id === s.id ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50'}`}
                >
                  <Avatar className="h-10 w-10 border">
                    <AvatarFallback className="bg-slate-100 text-primary font-bold">{(s.name || '').substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-semibold text-sm truncate">{s.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{s.role}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="p-4 border-b bg-slate-50/50 flex flex-row items-center gap-3">
            <Avatar className="h-10 w-10 border">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">{(selectedStaff?.name || '').substring(0, 2)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-sm font-bold">{selectedStaff.name}</CardTitle>
              <CardDescription className="text-xs">{selectedStaff.role}</CardDescription>
            </div>
          </CardHeader>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">جاري تحميل المحادثة...</div>
              ) : messages.length > 0 ? (
                messages.map((msg, i) => {
                  const isMe = msg.senderId === user?.uid;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-slate-100 text-foreground rounded-tl-none'}`}>
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <div className={`flex items-center gap-1 mt-1 text-[0.65rem] ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          <span>{toDate(msg.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && (msg.read ? <CheckCheck size={12} /> : <Check size={12} />)}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">ابدأ المحادثة مع {selectedStaff.name}</p>
                  <p className="text-xs mt-1">سيقوم الفريق الطبي بالرد عليك في أقرب وقت ممكن.</p>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <CardContent className="p-4 border-t bg-white">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input 
                placeholder="اكتب رسالتك هنا..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                <Send size={18} className="rotate-180" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
