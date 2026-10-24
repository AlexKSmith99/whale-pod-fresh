import React, { useState, useCallback } from 'react';
import { StatusBar } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, SUPABASE_URL } from '../../config/supabase';
import { AppAlert } from '../../components/ui/AppAlert';
import { ApplyData, EMPTY_APPLY_DATA, StepProps } from './types';

import NameStep from './steps/NameStep';
import WhoStep from './steps/WhoStep';
import EmailStep from './steps/EmailStep';
import UsernameStep from './steps/UsernameStep';
import PasswordStep from './steps/PasswordStep';
import BirthdayStep from './steps/BirthdayStep';
import PodTypesStep from './steps/PodTypesStep';
import PodCategoriesStep from './steps/PodCategoriesStep';
import UploadPhotosStep from './steps/UploadPhotosStep';
import SelfieStep from './steps/SelfieStep';
import SetProfilePicStep from './steps/SetProfilePicStep';
import ApplicationSentScreen from './ApplicationSentScreen';
import WaitingListScreen from './WaitingListScreen';

// Ordered data-collection steps (the "X of N" screens).
const STEPS: React.ComponentType<StepProps>[] = [
  NameStep,
  WhoStep,
  EmailStep,
  UsernameStep,
  PasswordStep,
  BirthdayStep,
  PodTypesStep,
  PodCategoriesStep,
  UploadPhotosStep,
  SelfieStep,
  SetProfilePicStep,
];

interface Props {
  onExit: () => void; // back out of the flow from the first step
}

function calcAge(d: Date): number {
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
  return age;
}

async function uploadLocal(uri: string, token: string, userId: string): Promise<string | null> {
  try {
    const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `${userId}/${Date.now()}-${Math.round(performance.now())}.${ext}`;
    const form = new FormData();
    form.append('file', { uri, type: `image/${ext === 'jpg' ? 'jpeg' : ext}`, name: fileName } as any);
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/profile-pictures/${fileName}`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
    );
    if (!res.ok) return null;
    return supabase.storage.from('profile-pictures').getPublicUrl(fileName).data.publicUrl;
  } catch {
    return null;
  }
}

export default function ApplyFlow({ onExit }: Props) {
  const auth = useAuth();
  const [data, setData] = useState<ApplyData>(EMPTY_APPLY_DATA);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'form' | 'sent' | 'waiting'>('form');
  const [submitting, setSubmitting] = useState(false);

  const update = useCallback((patch: Partial<ApplyData>) => setData(prev => ({ ...prev, ...patch })), []);

  const onBack = useCallback(() => {
    if (index === 0) onExit();
    else setIndex(i => i - 1);
  }, [index, onExit]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      await auth.signUp(data.email.trim(), data.password);
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      const userId = session?.user?.id;

      let photoUrls: string[] = [];
      let selfieUrl: string | null = null;
      if (session && userId) {
        for (const uri of data.photos) {
          const url = await uploadLocal(uri, session.access_token, userId);
          if (url) photoUrls.push(url);
        }
        if (data.selfieUri) selfieUrl = await uploadLocal(data.selfieUri, session.access_token, userId);
      }
      const profilePic = photoUrls[data.profilePicIndex] || photoUrls[0] || null;

      if (userId) {
        const payload: Record<string, any> = {
          name: `${data.firstName.trim()} ${data.lastName.trim()}`.trim(),
          username: data.username.trim() || null,
          gender: data.gender || null,
          date_of_birth: data.birthday ? data.birthday.toISOString().split('T')[0] : null,
          age: data.birthday ? calcAge(data.birthday) : null,
          pod_types: data.podTypes,
          pod_categories: data.podCategories,
          profile_pictures: photoUrls,
          profile_picture: profilePic,
          selfie_url: selfieUrl,
          application_status: 'pending',
          applied_at: new Date().toISOString(),
          onboarding_completed: false,
          updated_at: new Date().toISOString(),
        };
        let { error } = await supabase.from('profiles').update(payload).eq('id', userId);
        // Resilient fallback if migrations 072/073 (new columns) aren't applied yet.
        if (error) {
          for (const col of ['username', 'pod_types', 'pod_categories', 'selfie_url', 'application_status', 'applied_at']) {
            if (error?.message?.includes(col)) delete payload[col];
          }
          ({ error } = await supabase.from('profiles').update(payload).eq('id', userId));
          if (error) console.warn('Profile update (post-fallback) failed:', error.message);
        }
      }

      // Best-effort verification email (no-op if confirmation isn't pending).
      try { await supabase.auth.resend({ type: 'signup', email: data.email.trim() }); } catch {}

      setPhase('sent');
    } catch (e: any) {
      AppAlert.alert('Something went wrong', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [auth, data]);

  const onNext = useCallback(() => {
    if (index < STEPS.length - 1) setIndex(i => i + 1);
    else submit();
  }, [index, submit]);

  if (phase === 'waiting') return <WaitingListScreen />;
  if (phase === 'sent') return <ApplicationSentScreen onNext={() => setPhase('waiting')} />;

  const StepComponent = STEPS[index];
  return (
    <>
      {/* dark-content: the flow runs on the cream editorial page now, not black. */}
      <StatusBar barStyle="dark-content" />
      <StepComponent
        data={data}
        update={update}
        onNext={onNext}
        onBack={onBack}
        stepIndex={index + 1}
        stepCount={STEPS.length}
        // submitting is only meaningful on the final step
        {...(index === STEPS.length - 1 ? { submitting } : {})}
      />
    </>
  );
}
