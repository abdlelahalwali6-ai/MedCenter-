/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, LogIn, AlertCircle } from 'lucide-react';
import { UserProfile } from '@/src/types';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
          setConnectionError(true);
        }
      }
    }
    testConnection();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if profile exists
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        // Check if this is the bootstrap admin
        const isAdminEmail = user.email === 'abdlelahalwali6@gmail.com';
        
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'مستخدم جديد',
          role: isAdminEmail ? 'admin' : 'patient',
          photoURL: user.photoURL || undefined,
          createdAt: serverTimestamp(),
        };
        
        await setDoc(docRef, newProfile);
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      setError("حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4" dir="rtl">
      <Card className="w-full max-w-md border-t-4 border-t-primary shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-primary text-primary-foreground p-3 rounded-2xl w-fit shadow-lg shadow-primary/20">
            <Activity size={40} />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-bold tracking-tight">مد كير</CardTitle>
            <CardDescription className="text-lg">نظام إدارة المركز الطبي المتكامل</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {connectionError && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3 items-start text-amber-800 text-sm">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-bold">خطأ في الاتصال بقاعدة البيانات</p>
                <p>يرجى التأكد من إعدادات Firebase بشكل صحيح.</p>
              </div>
            </div>
          )}

          <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground leading-relaxed">
            مرحباً بك في نظام مد كير. يرجى تسجيل الدخول للوصول إلى لوحة التحكم الخاصة بك ومتابعة المواعيد والسجلات الطبية.
          </div>
          
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm text-center border border-destructive/20">
              {error}
            </div>
          )}

          <Button 
            onClick={handleLogin} 
            disabled={loading || connectionError}
            className="w-full h-12 text-lg font-medium gap-3 shadow-md hover:shadow-lg transition-all"
          >
            <LogIn size={20} />
            {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول عبر جوجل'}
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center border-t pt-6 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} مد كير HIS - جميع الحقوق محفوظة
        </CardFooter>
      </Card>
    </div>
  );
}
