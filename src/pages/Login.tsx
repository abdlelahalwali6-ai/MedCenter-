/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, LogIn, AlertCircle, UserPlus, Mail, Phone, User, Lock, ArrowLeft } from 'lucide-react';
import { UserProfile } from '@/src/types';
import { toast } from 'sonner';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [view, setView] = useState<'auth' | 'forgot-password'>('auth');
  
  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('');

  useEffect(() => {
    async function testConnection() {
      try {
        // Use a path that we explicitly allowed in firestore.rules
        await getDocFromServer(doc(db, '_connection_test_', 'ping'));
        console.log("Firestore connection verified.");
      } catch (error: any) {
        console.warn("Connection test result:", error.code || error.message);
        // We only care if the error is "offline"
        if (error.message?.includes('offline') || error.code === 'unavailable') {
          setConnectionError(true);
        }
      }
    }
    testConnection();
  }, []);

  const resolveEmail = async (identifier: string): Promise<string | null> => {
    // 1. Check if it's already an email
    if (identifier.includes('@') && identifier.includes('.')) {
      return identifier;
    }

    try {
      // 2. Try searching by phone number
      const phoneQuery = query(
        collection(db, 'users'), 
        where('phoneNumber', '==', identifier),
        limit(1)
      );
      const phoneSnap = await getDocs(phoneQuery);
      if (!phoneSnap.empty) {
        return phoneSnap.docs[0].data().email;
      }

      // 3. Try searching by name (displayName)
      const nameQuery = query(
        collection(db, 'users'), 
        where('displayName', '==', identifier),
        limit(1)
      );
      const nameSnap = await getDocs(nameQuery);
      if (!nameSnap.empty) {
        return nameSnap.docs[0].data().email;
      }
    } catch (e) {
      console.error("Lookup error:", e);
      // Rules might block unauthenticated lookup if not matched
    }

    return null;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier || !loginPassword) {
      setError("يرجى إدخال اسم المستخدم/كلمة المرور");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const email = await resolveEmail(loginIdentifier);
      if (!email) {
        // Safe rejection logic: don't reveal if user exists or email resolve failed
        throw new Error("بيانات الدخول غير صحيحة");
      }

      await signInWithEmailAndPassword(auth, email, loginPassword);
      
      // Force role update for admin just in case
      if (email.toLowerCase() === 'abdlelahalwali6@gmail.com') {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().role !== 'admin') {
            await updateDoc(docRef, { role: 'admin' });
          }
        }
      }

      toast.success("تم تسجيل الدخول بنجاح");
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError("بيانات الدخول غير صحيحة");
      } else if (err.code === 'auth/firebase-app-check-token-is-invalid') {
        setError("خطأ في نظام الحماية (App Check). يرجى التأكد من أنك لا تستخدم 'VPN' أو إضافات تمنع التحقق، أو قم بتعطيل 'Enforcement' في لوحة تحكم Firebase.");
      } else {
        setError("حدث خطأ أثناء تسجيل الدخول. يرجى التأكد من استقرار الاتصال.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupPassword || !signupName || !signupPhone) {
      setError("يرجى إكمال جميع الحقول");
      return;
    }

    if (signupPassword.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createUserWithEmailAndPassword(auth, signupEmail, signupPassword);
      const user = result.user;

      await updateProfile(user, { displayName: signupName });

      // Create profile in Firestore
      const docRef = doc(db, 'users', user.uid);
      
      const isAdminEmail = signupEmail.toLowerCase() === 'abdlelahalwali6@gmail.com';

      const newProfile: UserProfile = {
        uid: user.uid,
        email: signupEmail,
        displayName: signupName,
        phoneNumber: signupPhone,
        role: isAdminEmail ? 'admin' : 'patient',
        createdAt: serverTimestamp(),
      };

      await setDoc(docRef, newProfile);
      toast.success("تم إنشاء الحساب بنجاح");
    } catch (err: any) {
      console.error("Signup Error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("البريد الإلكتروني مستخدم بالفعل");
      } else if (err.code === 'auth/weak-password') {
        setError("كلمة المرور ضعيفة جداً");
      } else if (err.code === 'auth/firebase-app-check-token-is-invalid') {
        setError("خطأ في نظام الحماية (App Check). يرجى التأكد من عدم وجود إضافات تمنع الاتصال بـ Firebase أو تواصل مع الدعم.");
      } else {
        setError("حدث خطأ أثناء إنشاء الحساب. تأكد من استقرار الاتصال بالإنترنت.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setError("يرجى إدخال البريد الإلكتروني");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني");
      setView('auth');
    } catch (err: any) {
      console.error("Reset Error:", err);
      setError("عذراً، تعذر إرسال رابط إعادة التعيين. تأكد من صحة البريد الإلكتروني.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      const isAdminEmail = (user.email || '').toLowerCase() === 'abdlelahalwali6@gmail.com';
      
      if (!docSnap.exists()) {
        const newProfile: any = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'مستخدم جديد',
          role: isAdminEmail ? 'admin' : 'patient',
          createdAt: serverTimestamp(),
        };

        if (user.photoURL) newProfile.photoURL = user.photoURL;
        if (user.phoneNumber) newProfile.phoneNumber = user.phoneNumber;
        
        await setDoc(docRef, newProfile);
      } else if (isAdminEmail && docSnap.data()?.role !== 'admin') {
        // Correct the role if the admin accidentally has a different role
        await updateDoc(docRef, { role: 'admin' });
      }
      toast.success("تم تسجيل الدخول بنجاح");
    } catch (err: any) {
      console.error("Google Login Error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        toast.error("تم إغلاق نافذة تسجيل الدخول. إذا كنت تستخدم المعاينة، جرب فتح التطبيق في نافذة مستقلة.");
        setError("تعذر إكمال تسجيل الدخول لأن النافذة أُغلقت. يرجى التأكد من السماح بالنوافذ المنبثقة.");
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("يرجى تفعيل تسجيل الدخول بواسطة جوجل في لوحة تحكم Firebase.");
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(`هذا النطاق (${window.location.hostname}) غير مضاف في قائمة النطاقات المصرح بها في Firebase Console.`);
      } else if (err.code === 'auth/firebase-app-check-token-is-invalid') {
        setError("فشل التحقق من أمان التطبيق (App Check). يرجى المحاولة من متصفح آخر أو تعطيل مانع الإعلانات.");
      } else {
        setError("حدث خطأ أثناء تسجيل الدخول عبر جوجل. تأكد من السماح بالنوافذ المنبثقة وإضافة نطاق الموقع في Firebase Console (Authorized Domains).");
      }
    } finally {
      setLoading(false);
    }
  };

  if (view === 'forgot-password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4" dir="rtl">
        <Card className="w-full max-w-md border-t-4 border-t-primary shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <button 
                onClick={() => setView('auth')}
                className="hover:bg-accent p-1 rounded-md transition-colors"
              >
                <ArrowLeft className="h-5 w-5 rotate-180" />
              </button>
              إستعادة كلمة المرور
            </CardTitle>
            <CardDescription>أدخل بريدك الإلكتروني وسنرسل لك رابطاً لتعيين كلمة مرور جديدة</CardDescription>
          </CardHeader>
          <form onSubmit={handleResetPassword}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm text-center border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="reset-email">البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="reset-email"
                    type="email"
                    placeholder="example@mail.com"
                    className="pr-10"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? 'جاري الإرسال...' : 'إرسال الرابط'}
              </Button>
              <Button 
                variant="ghost" 
                type="button" 
                className="w-full" 
                onClick={() => setView('auth')}
              >
                العودة لتسجيل الدخول
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4" dir="rtl">
      <Card className="w-full max-w-md border-t-4 border-t-primary shadow-xl overflow-hidden">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto bg-primary text-primary-foreground p-3 rounded-2xl w-fit shadow-lg shadow-primary/20">
            <Activity size={40} />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-bold tracking-tight">أمان الطبي</CardTitle>
            <CardDescription className="text-lg">نظام إدارة المركز الطبي المتكامل</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {connectionError && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3 items-start text-amber-800 text-sm">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-bold">خطأ في الاتصال بقاعدة البيانات</p>
                <p>يرجى التأكد من إعدادات Firebase بشكل صحيح.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm text-center border border-destructive/20 animate-in fade-in zoom-in duration-300">
              {error}
            </div>
          )}

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" className="gap-2">
                <LogIn size={16} />
                تسجيل الدخول
              </TabsTrigger>
              <TabsTrigger value="signup" className="gap-2">
                <UserPlus size={16} />
                إنشاء حساب
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-identifier">الاسم، الرقم أو البريد الإلكتروني</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="login-identifier"
                      placeholder="أدخل الاسم أو الرقم أو البريد"
                      className="pr-10"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">كلمة المرور</Label>
                    <button 
                      type="button" 
                      onClick={() => setView('forgot-password')}
                      className="text-xs text-primary hover:underline"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="login-password"
                      type="password"
                      className="pr-10"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium gap-2 shadow-md hover:shadow-lg transition-all"
                  disabled={loading || connectionError}
                >
                  <LogIn size={18} />
                  {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">الاسم الكامل</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="signup-name"
                      placeholder="أدخل اسمك الكامل"
                      className="pr-10"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">رقم الهاتف</Label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="signup-phone"
                      placeholder="05xxxxxxx"
                      className="pr-10"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">البريد الإلكتروني</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="signup-email"
                      type="email"
                      placeholder="example@mail.com"
                      className="pr-10"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">كلمة المرور</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="signup-password"
                      type="password"
                      className="pr-10"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium gap-2 shadow-md"
                  disabled={loading || connectionError}
                >
                  <UserPlus size={18} />
                  {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب جديد'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">أو استخدم</span>
            </div>
          </div>

          <Button 
            variant="outline"
            onClick={handleGoogleLogin} 
            disabled={loading || connectionError}
            className="w-full h-11 text-base font-medium gap-3 shadow-sm hover:bg-accent transition-all"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 6.28l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            تسجيل الدخول عبر جوجل
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 justify-center border-t py-4 text-xs text-muted-foreground bg-muted/20">
          <p>&copy; {new Date().getFullYear()} أمان الطبي HIS - جميع الحقوق محفوظة</p>
          <p className="text-[10px] opacity-70">صمم من أجل رعاية صحية أفضل</p>
        </CardFooter>
      </Card>
    </div>
  );
}
