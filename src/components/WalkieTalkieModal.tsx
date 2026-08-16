// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { realtimeService } from '../services/pusherRealtime';

export default function WalkieTalkieModal({ visible, onClose, peerName = 'Driver Ramesh', peerRole = 'driver', peerId = '1' }) {
  const [isTalking, setIsTalking] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [channel, setChannel] = useState('Ch-1 (Quarry Direct)');
  const [callActive, setCallActive] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const mediaRecorderRef = useRef(null);

  // Listen to incoming real-time Push-to-Talk (PTT) events
  useEffect(() => {
    if (visible) {
      realtimeService.init();

      realtimeService.on('ptt-active-start', (data) => {
        setIsReceiving(true);
        startPulse();
      });

      realtimeService.on('ptt-active-stop', (data) => {
        setIsReceiving(false);
        stopPulse();
      });

      realtimeService.on('ptt-incoming-audio', (data) => {
        if (data && data.chunk) {
          playIncomingAudioChunk(data.chunk);
        }
      });

      realtimeService.on('call-signal-received', (data) => {
        if (data.type === 'start-call') {
          setCallActive(true);
          Alert.alert('📞 Incoming Voice Call', `${peerName} is calling...`);
        } else if (data.type === 'end-call') {
          setCallActive(false);
        }
      });
    }
    return () => {
      stopPulse();
    };
  }, [visible, peerName]);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const sendWalkieEvent = async (eventType, payload = {}) => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
      await fetch(`${baseUrl}/api/walkie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, payload }),
      });
    } catch (e) {
      // Trigger client fallback
      realtimeService.triggerClientEvent(eventType, payload);
    }
  };

  // Push to Talk (PTT) Press & Release
  const handlePttPressIn = async () => {
    setIsTalking(true);
    startPulse();
    sendWalkieEvent('ptt-start', { peerId, peerName, channel });

    // Web MediaRecorder / Audio stream mic capture
    if (typeof window !== 'undefined' && window.navigator?.mediaDevices) {
      startWebAudioRecording();
    }
  };

  const handlePttPressOut = () => {
    setIsTalking(false);
    stopPulse();
    sendWalkieEvent('ptt-stop', { peerId, channel });
    stopWebAudioRecording();
  };

  const startWebAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          const reader = new FileReader();
          reader.onloadend = () => {
            sendWalkieEvent('ptt-audio-chunk', { peerId, chunk: reader.result });
          };
          reader.readAsDataURL(e.data);
        }
      };
      mediaRecorder.start(250); // 250ms chunks
    } catch (e) {
      console.warn('Mic permission error:', e);
    }
  };

  const stopWebAudioRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  const playIncomingAudioChunk = (base64Data) => {
    if (typeof window !== 'undefined' && base64Data) {
      try {
        const audio = new Audio(base64Data);
        audio.play().catch(() => {});
      } catch (e) {}
    }
  };

  const toggleVoiceCall = () => {
    if (callActive) {
      setCallActive(false);
      sendWalkieEvent('call-signal', { type: 'end-call', peerId });
      Alert.alert('Call Ended', `Voice call with ${peerName} ended.`);
    } else {
      setCallActive(true);
      sendWalkieEvent('call-signal', { type: 'start-call', peerId });
      Alert.alert('Calling...', `Connecting live voice call to ${peerName}...`);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.radioBody}>
          {/* Tactical Header */}
          <View style={styles.radioHeader}>
            <View style={styles.frequencyBadge}>
              <View style={styles.greenDot} />
              <Text style={styles.frequencyText}>{channel}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Peer Display */}
          <View style={styles.peerSection}>
            <Animated.View style={[styles.avatarCircle, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="radio" size={36} color={isTalking ? '#EF4444' : isReceiving ? '#10B981' : Colors.primary} />
            </Animated.View>
            <Text style={styles.peerName}>{peerName}</Text>
            <Text style={styles.peerStatus}>
              {isTalking
                ? '🎙️ TRANSMITTING VOICE...'
                : isReceiving
                ? '📻 RECEIVING AUDIO STREAM...'
                : callActive
                ? '📞 DIRECT VOICE CALL ACTIVE'
                : 'READY TO TRANSMIT (PTT)'}
            </Text>
          </View>

          {/* Direct Voice Call Toggle */}
          <View style={styles.callRow}>
            <TouchableOpacity
              style={[styles.callBtn, { backgroundColor: callActive ? '#DC2626' : '#16A34A' }]}
              onPress={toggleVoiceCall}
            >
              <Ionicons name={callActive ? 'call-outline' : 'call'} size={18} color="#FFF" />
              <Text style={styles.callBtnText}>{callActive ? 'End Voice Call' : 'Start Voice Call'}</Text>
            </TouchableOpacity>
          </View>

          {/* Push To Talk (PTT) Hold Button */}
          <View style={styles.pttSection}>
            <TouchableOpacity
              style={[styles.pttButton, isTalking && styles.pttButtonActive]}
              activeOpacity={0.85}
              onPressIn={handlePttPressIn}
              onPressOut={handlePttPressOut}
            >
              <Ionicons name="mic" size={44} color="#FFF" />
              <Text style={styles.pttText}>HOLD TO TALK</Text>
              <Text style={styles.pttSub}>Push & Hold to Speak</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  radioBody: {
    backgroundColor: '#1E293B', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.xl, borderWidth: 1, borderColor: '#334155',
  },
  radioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  frequencyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F172A', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  frequencyText: { color: '#10B981', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  peerSection: { alignItems: 'center', marginVertical: Spacing.md },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#0F172A',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    borderWidth: 3, borderColor: Colors.primary,
  },
  peerName: { ...Typography.h1, color: '#FFF', fontSize: 22 },
  peerStatus: { ...Typography.caption, color: '#94A3B8', fontWeight: '700', marginTop: 4, letterSpacing: 0.5 },
  callRow: { marginVertical: Spacing.md },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: BorderRadius.md },
  callBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  pttSection: { alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.lg },
  pttButton: {
    width: 170, height: 170, borderRadius: 85,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.5, shadowRadius: 15, elevation: 8,
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)',
  },
  pttButtonActive: { backgroundColor: '#EF4444', borderColor: '#FCA5A5' },
  pttText: { color: '#FFF', fontWeight: '900', fontSize: 16, marginTop: 6 },
  pttSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
});
