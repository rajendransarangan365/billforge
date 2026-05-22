import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Typography, BorderRadius, Spacing } from '../theme';
import { Ionicons } from '@expo/vector-icons';

export function DateTimePickerInput({
  label,
  value,
  onChange,
  mode = 'date',
  required = false,
  error,
  style,
}) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState(value || new Date());
  const [androidPickerMode, setAndroidPickerMode] = useState('date');

  const formatValue = () => {
    if (!value) return '';
    let dateObj = value;
    if (!(value instanceof Date)) {
      dateObj = new Date(value);
    }
    if (isNaN(dateObj.getTime())) return '';

    if (mode === 'date') {
      return dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
    if (mode === 'time') {
      return dateObj.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
    if (mode === 'datetime') {
      return dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) + ' ' + dateObj.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
    return dateObj.toLocaleString('en-IN');
  };

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (event.type === 'set' && selectedDate) {
        if (mode === 'datetime') {
          if (androidPickerMode === 'date') {
            // Date selected, now switch to time picker
            setTempDate(selectedDate);
            setAndroidPickerMode('time');
            setTimeout(() => {
              setShow(true);
            }, 100);
          } else {
            // Time selected, merge and complete sequential selection
            const finalDate = new Date(tempDate);
            finalDate.setHours(selectedDate.getHours());
            finalDate.setMinutes(selectedDate.getMinutes());
            onChange(finalDate);
            setAndroidPickerMode('date'); // reset for next open
          }
        } else {
          onChange(selectedDate);
        }
      } else {
        // Cancelled
        setAndroidPickerMode('date');
      }
    } else {
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleConfirm = () => {
    onChange(tempDate);
    setShow(false);
  };

  const handleCancel = () => {
    setTempDate(value || new Date());
    setAndroidPickerMode('date');
    setShow(false);
  };

  const iconName = mode === 'date' ? 'calendar-outline' : 'time-outline';

  // Web Fallback
  if (Platform.OS === 'web') {
    let inputType = 'date';
    let inputValue = '';
    
    let dateObj = value;
    if (value && !(value instanceof Date)) {
      dateObj = new Date(value);
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
      if (mode === 'date') {
        inputType = 'date';
        inputValue = dateObj.toISOString().split('T')[0];
      } else if (mode === 'time') {
        inputType = 'time';
        inputValue = dateObj.toTimeString().slice(0, 5);
      } else if (mode === 'datetime') {
        inputType = 'datetime-local';
        const offset = dateObj.getTimezoneOffset();
        const adjustedDate = new Date(dateObj.getTime() - (offset * 60 * 1000));
        inputValue = adjustedDate.toISOString().slice(0, 16);
      }
    } else {
      if (mode === 'date') inputType = 'date';
      else if (mode === 'time') inputType = 'time';
      else if (mode === 'datetime') inputType = 'datetime-local';
    }

    return (
      <View style={[styles.container, style]}>
        {label && (
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        )}
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type={inputType}
            value={inputValue}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                if (mode === 'datetime') {
                  onChange(new Date(val));
                } else {
                  const baseDate = value ? new Date(value) : new Date();
                  if (mode === 'date') {
                    const [y, m, d] = val.split('-');
                    baseDate.setFullYear(parseInt(y), parseInt(m) - 1, parseInt(d));
                  } else {
                    const [h, min] = val.split(':');
                    baseDate.setHours(parseInt(h), parseInt(min));
                  }
                  onChange(baseDate);
                }
              }
            }}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '8px',
              border: `1.5px solid ${error ? Colors.danger : Colors.border}`,
              backgroundColor: Colors.surfaceElevated,
              fontSize: '14px',
              fontFamily: 'inherit',
              color: Colors.text,
              outline: 'none',
              boxSizing: 'border-box',
              minHeight: '46px'
            }}
          />
        </div>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <TouchableOpacity
        style={[styles.inputWrapper, error && styles.inputError]}
        onPress={() => {
          const initDate = value ? (value instanceof Date ? value : new Date(value)) : new Date();
          setTempDate(isNaN(initDate.getTime()) ? new Date() : initDate);
          setAndroidPickerMode('date');
          setShow(true);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name={iconName} size={18} color={Colors.textTertiary} style={styles.icon} />
        <Text style={[styles.inputText, !value && styles.placeholder]}>
          {value ? formatValue() : `Select ${mode}`}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}

      {Platform.OS === 'ios' && show && (
        <Modal
          transparent
          animationType="slide"
          visible={show}
          onRequestClose={handleCancel}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={handleCancel}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  {mode === 'date' ? 'Select Date' : (mode === 'time' ? 'Select Time' : 'Select Date & Time')}
                </Text>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={styles.modalDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode={mode}
                display="spinner"
                onChange={handleChange}
                textColor={Colors.text}
                style={styles.picker}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={tempDate}
          mode={mode === 'datetime' ? androidPickerMode : mode}
          display="default"
          onChange={handleChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.captionMedium,
    color: Colors.text,
    marginBottom: Spacing.xs + 2,
  },
  required: {
    color: Colors.danger,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 46,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  inputText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
    paddingVertical: Spacing.sm + 2,
  },
  placeholder: {
    color: Colors.textTertiary,
  },
  error: {
    ...Typography.small,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  modalCancel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  modalDone: {
    ...Typography.bodySemibold,
    color: Colors.primary,
  },
  picker: {
    height: 200,
  },
});
