import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Mic, Square, Send, X } from 'lucide-react-native';

// ---- Native speech recognition (dev build only) ----
let NativeSpeech: any = null;
let useNativeSpeechEvent: ((name: string, cb: any) => void) | null = null;

try {
  const mod = require('expo-speech-recognition');
  NativeSpeech = mod.ExpoSpeechRecognitionModule;
  useNativeSpeechEvent = mod.useSpeechRecognitionEvent;
} catch {
  // Not available (Expo Go or web) — that's fine
}

// Noop hook when native not available
const noopHook = (_name: string, _cb: any) => {};

// ---- Web Speech API detection ----
const getWebSpeech = (): any => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

// ---- Which engine is available? ----
const resolveEngine = (): 'native' | 'web' | 'none' => {
  if (Platform.OS !== 'web' && NativeSpeech) return 'native';
  if (getWebSpeech()) return 'web';
  return 'none';
};

// ==========================================================================

interface Props {
  onTranscription: (text: string) => void;
  isProcessing: boolean;
}

export default function VoiceRecorder({ onTranscription, isProcessing }: Props) {
  const engine = resolveEngine();

  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const webRecogRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ---- Native speech events (always call 4 hooks for stable count) ----
  const useSpeechHook = useNativeSpeechEvent || noopHook;
  useSpeechHook('start', () => setIsListening(true));
  useSpeechHook('end', () => {
    setIsListening(false);
    // auto-open editor so user can review
    if (text.trim()) setExpanded(true);
  });
  useSpeechHook('result', (e: any) => {
    const t = e.results?.[0]?.transcript ?? '';
    setLiveTranscript(t);
    setText(t);
  });
  useSpeechHook('error', (e: any) => {
    console.warn('Speech error', e.error, e.message);
    setIsListening(false);
    // fallback to text input
    setExpanded(true);
  });

  // ---- Pulse animation ----
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  // ---- Start / stop helpers ----
  const startListening = async () => {
    setLiveTranscript('');
    setText('');

    if (engine === 'native') {
      const { granted } = await NativeSpeech.requestPermissionsAsync();
      if (!granted) { setExpanded(true); return; }
      await NativeSpeech.start({ lang: '', interimResults: true, continuous: true });
    } else if (engine === 'web') {
      const Ctor = getWebSpeech();
      const r = new Ctor();
      r.lang = '';
      r.continuous = true;
      r.interimResults = true;
      let final = '';
      r.onresult = (ev: any) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) final += ev.results[i][0].transcript + ' ';
          else interim = ev.results[i][0].transcript;
        }
        const combined = (final + interim).trim();
        setLiveTranscript(combined);
        setText(combined);
      };
      r.onerror = () => { setIsListening(false); setExpanded(true); };
      r.onend = () => { setIsListening(false); if (text.trim()) setExpanded(true); };
      webRecogRef.current = r;
      r.start();
      setIsListening(true);
    } else {
      setExpanded(true);
    }
  };

  const stopListening = async () => {
    if (engine === 'native' && NativeSpeech) {
      await NativeSpeech.stop();
    } else if (webRecogRef.current) {
      webRecogRef.current.stop();
      webRecogRef.current = null;
    }
    setIsListening(false);
    if (text.trim()) setExpanded(true);
  };

  // ---- Actions ----
  const handleMicPress = () => (isListening ? stopListening() : startListening());

  const handleSend = () => {
    const t = text.trim();
    if (t) { onTranscription(t); setText(''); setLiveTranscript(''); setExpanded(false); }
  };

  const handleCancel = () => {
    if (isListening) stopListening();
    setText(''); setLiveTranscript(''); setExpanded(false);
  };

  // ---- Render: Processing ----
  if (isProcessing) {
    return (
      <View style={s.container} testID="voice-recorder">
        <View style={s.busyWrap}>
          <ActivityIndicator size="large" color="#4A6B53" />
          <Text style={s.busyText}>Lamdi is thinking...</Text>
        </View>
      </View>
    );
  }

  // ---- Render: Listening ----
  if (isListening) {
    return (
      <View style={s.container} testID="voice-recorder">
        <View style={s.listenRow}>
          <View style={s.liveDot} />
          <Text style={s.listenLabel}>Listening...</Text>
        </View>
        {liveTranscript ? (
          <Text style={s.liveText}>{liveTranscript}</Text>
        ) : (
          <Text style={s.liveHint}>Speak now — in any language</Text>
        )}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity testID="voice-stop-button" style={s.fabStop} onPress={() => stopListening()} activeOpacity={0.8}>
            <Square size={28} color="#FFFFFF" fill="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
        <Text style={s.hint}>Tap to stop</Text>
      </View>
    );
  }

  // ---- Render: Collapsed (mic button) ----
  if (!expanded) {
    const hasVoice = engine !== 'none';
    return (
      <View style={s.container} testID="voice-recorder">
        <TouchableOpacity testID="voice-record-button" style={s.fab} onPress={handleMicPress} activeOpacity={0.8}
          accessible accessibilityLabel="Tap to speak or type a task" accessibilityRole="button">
          <Mic size={36} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.hint}>Tap to speak</Text>
        <Text style={s.sub}>
          {hasVoice
            ? engine === 'native' ? 'Device speech recognition' : 'Voice recognition active'
            : 'Type your tasks naturally'}
        </Text>
        <TouchableOpacity testID="expand-text-input" onPress={() => setExpanded(true)} style={s.typeLink}>
          <Text style={s.typeLinkText}>or type instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---- Render: Expanded (text editor) ----
  const hasVoice = engine !== 'none';
  return (
    <View style={s.expanded} testID="voice-recorder-expanded">
      <Text style={s.expTitle}>What do you need to do?</Text>
      <Text style={s.expSub}>Create tasks, mark done, or change deadlines</Text>

      <TextInput testID="voice-text-input" style={s.input} value={text} onChangeText={setText}
        placeholder='e.g. "I finished calling Nguyen" or "Buy rice tomorrow"'
        placeholderTextColor="#B8C4B9" multiline autoFocus textAlignVertical="top"
        returnKeyType="send" blurOnSubmit={false} onSubmitEditing={handleSend} />

      <View style={s.chips}>
        <Text style={s.chipLabel}>Try:</Text>
        <TouchableOpacity onPress={() => setText('I finished the inventory check')}><Text style={s.chip}>Mark done</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setText('Move bank call to Friday')}><Text style={s.chip}>Change date</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setText('Call supplier tomorrow, urgent')}><Text style={s.chip}>New task</Text></TouchableOpacity>
      </View>

      <View style={s.actions}>
        <TouchableOpacity testID="cancel-voice-input" style={s.cancelBtn} onPress={handleCancel}>
          <X size={16} color="#5C6A5D" /><Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
        {hasVoice && (
          <TouchableOpacity testID="start-voice-btn" style={s.voiceBtn} onPress={() => startListening()} activeOpacity={0.8}>
            <Mic size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity testID="send-voice-input" style={[s.sendBtn, !text.trim() && s.sendOff]} onPress={handleSend}
          disabled={!text.trim()} activeOpacity={0.8}>
          <Send size={18} color="#FFFFFF" /><Text style={s.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ==========================================================================
const s = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 16 },
  fab: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#D48C70',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#D48C70', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 10, marginBottom: 8,
  },
  fabStop: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#D35F5F',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#D35F5F', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8, marginTop: 12, marginBottom: 8,
  },
  hint: { color: '#5C6A5D', fontSize: 14, fontWeight: '500' },
  sub: { color: '#B8C4B9', fontSize: 12, marginTop: 4 },
  typeLink: { marginTop: 10 },
  typeLinkText: { color: '#4A6B53', fontSize: 13, fontWeight: '500', textDecorationLine: 'underline' },

  listenRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D35F5F', marginRight: 8 },
  listenLabel: { color: '#D35F5F', fontSize: 15, fontWeight: '700' },
  liveText: { fontSize: 16, color: '#2D372E', textAlign: 'center', paddingHorizontal: 16, marginBottom: 8, lineHeight: 22 },
  liveHint: { fontSize: 14, color: '#B8C4B9', fontStyle: 'italic', marginBottom: 8 },

  busyWrap: { alignItems: 'center', padding: 24 },
  busyText: { color: '#4A6B53', fontSize: 15, fontWeight: '600', marginTop: 12 },

  expanded: { paddingVertical: 8 },
  expTitle: { fontSize: 17, fontWeight: '700', color: '#2D372E', marginBottom: 4 },
  expSub: { fontSize: 13, color: '#5C6A5D', marginBottom: 14, lineHeight: 18 },
  input: {
    backgroundColor: '#F9F9F6', borderRadius: 14, padding: 14, fontSize: 15,
    color: '#2D372E', borderWidth: 1, borderColor: '#E8EBE8', minHeight: 80, marginBottom: 10,
  },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  chipLabel: { fontSize: 12, color: '#5C6A5D', fontWeight: '600' },
  chip: {
    fontSize: 12, color: '#D48C70', backgroundColor: '#FAEFEA',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: 'hidden',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, gap: 4 },
  cancelText: { color: '#5C6A5D', fontSize: 14, fontWeight: '500' },
  voiceBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#D48C70', justifyContent: 'center', alignItems: 'center' },
  sendBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#4A6B53', borderRadius: 14, padding: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
  sendOff: { backgroundColor: '#B8C4B9' },
  sendText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
