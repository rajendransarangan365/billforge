import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Platform, Pressable, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const YEARS = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - 10 + i);
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function formatDateDisplay(dateObj, mode) {
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = String(dateObj.getFullYear()).slice(-2); // 2 digit year for compact layout! E.g. "26" instead of "2026"
  
  let hours = dateObj.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const min = String(dateObj.getMinutes()).padStart(2, '0');
  const timeStr = `${String(hours).padStart(2, '0')}:${min} ${ampm}`;
  
  if (mode === 'date') {
    return `${day}-${month}-${year}`; // e.g. 23-05-26
  }
  if (mode === 'time') {
    return timeStr; // e.g. 09:02 AM
  }
  return `${day}-${month}-${year} ${timeStr}`; // e.g. 23-05-26 09:02 AM
}

// ─── Calendar Tab ────────────────────────────────────────────────────────────

function CalendarPicker({ selected, onSelect }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(selected ? selected.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected ? selected.getMonth() : today.getMonth());
  const [showYearPicker, setShowYearPicker] = useState(false);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isSelected = (d) =>
    selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === d;

  const isToday = (d) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === d;

  return (
    <View>
      {/* Month/Year Header */}
      <View style={cal.header}>
        <TouchableOpacity style={cal.navBtn} onPress={prevMonth}>
          <Ionicons name="chevron-back" size={20} color={Colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={cal.monthYearBtn} onPress={() => setShowYearPicker(v => !v)}>
          <Text style={cal.monthYear}>{MONTHS[viewMonth]} {viewYear}</Text>
          <Ionicons name={showYearPicker ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.accent} />
        </TouchableOpacity>

        <TouchableOpacity style={cal.navBtn} onPress={nextMonth}>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Year Picker */}
      {showYearPicker && (
        <ScrollView style={cal.yearScroll} showsVerticalScrollIndicator={false}>
          <View style={cal.yearGrid}>
            {YEARS.map(y => (
              <TouchableOpacity
                key={y}
                style={[cal.yearChip, y === viewYear && cal.yearChipActive]}
                onPress={() => { setViewYear(y); setShowYearPicker(false); }}
              >
                <Text style={[cal.yearChipText, y === viewYear && cal.yearChipTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {!showYearPicker && (
        <>
          {/* Day Labels */}
          <View style={cal.dayLabels}>
            {SHORT_DAYS.map(d => (
              <Text key={d} style={cal.dayLabel}>{d}</Text>
            ))}
          </View>

          {/* Day Grid */}
          <View style={cal.grid}>
            {cells.map((d, idx) => {
              if (!d) return <View key={`e${idx}`} style={cal.cell} />;
              const sel = isSelected(d);
              const tod = isToday(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={[cal.cell, sel && cal.cellSelected, !sel && tod && cal.cellToday]}
                  onPress={() => {
                    const base = selected ? new Date(selected) : new Date();
                    base.setFullYear(viewYear, viewMonth, d);
                    onSelect(base);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    cal.cellText,
                    sel && cal.cellTextSelected,
                    !sel && tod && cal.cellTextToday,
                  ]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Today Shortcut */}
          <TouchableOpacity
            style={cal.todayBtn}
            onPress={() => {
              const t = new Date();
              setViewYear(t.getFullYear());
              setViewMonth(t.getMonth());
              onSelect(t);
            }}
          >
            <Text style={cal.todayBtnText}>Today</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ─── Time Picker ─────────────────────────────────────────────────────────────

function TimePicker({ selected, onSelect }) {
  const now = selected && !isNaN(selected.getTime()) ? selected : new Date();
  const rawH = now.getHours();
  const [ampm, setAmpm] = useState(rawH >= 12 ? 'PM' : 'AM');
  const [hour, setHour] = useState(String(rawH % 12 === 0 ? 12 : rawH % 12).padStart(2, '0'));
  const [minute, setMinute] = useState(String(now.getMinutes()).padStart(2, '0'));

  const commit = useCallback((h, m, ap) => {
    const base = selected ? new Date(selected) : new Date();
    let h24 = parseInt(h);
    if (ap === 'PM' && h24 !== 12) h24 += 12;
    if (ap === 'AM' && h24 === 12) h24 = 0;
    base.setHours(h24, parseInt(m), 0, 0);
    onSelect(base);
  }, [selected]);

  const SpinCol = ({ values, current, onChange }) => (
    <ScrollView style={spin.col} showsVerticalScrollIndicator={false}>
      {values.map(v => {
        const active = v === current;
        return (
          <TouchableOpacity
            key={v}
            style={[spin.item, active && spin.itemActive]}
            onPress={() => { onChange(v); }}
            activeOpacity={0.7}
          >
            <Text style={[spin.itemText, active && spin.itemTextActive]}>{v}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={spin.container}>
      <View style={spin.clock}>
        <Ionicons name="time-outline" size={20} color={Colors.accent} />
        <Text style={spin.clockText}>
          {hour}:{minute} {ampm}
        </Text>
      </View>

      <View style={spin.cols}>
        <View style={spin.colWrap}>
          <Text style={spin.colLabel}>Hour</Text>
          <SpinCol
            values={HOURS}
            current={hour}
            onChange={v => { setHour(v); commit(v, minute, ampm); }}
          />
        </View>

        <View style={spin.separator} />

        <View style={spin.colWrap}>
          <Text style={spin.colLabel}>Min</Text>
          <SpinCol
            values={MINUTES}
            current={minute}
            onChange={v => { setMinute(v); commit(hour, v, ampm); }}
          />
        </View>

        <View style={spin.separator} />

        <View style={spin.colWrap}>
          <Text style={spin.colLabel}>AM/PM</Text>
          {['AM', 'PM'].map(ap => (
            <TouchableOpacity
              key={ap}
              style={[spin.ampmBtn, ampm === ap && spin.ampmBtnActive]}
              onPress={() => { setAmpm(ap); commit(hour, minute, ap); }}
            >
              <Text style={[spin.ampmText, ampm === ap && spin.ampmTextActive]}>{ap}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DateTimePickerInput({
  label,
  value,
  onChange,
  mode = 'date',
  required = false,
  error,
  style,
}) {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState(mode === 'time' ? 'time' : 'date');

  const dateObj = value ? (value instanceof Date ? value : new Date(value)) : null;
  const validDate = dateObj && !isNaN(dateObj.getTime()) ? dateObj : null;

  const displayText = validDate ? formatDateDisplay(validDate, mode) : `Select ${mode}`;

  const handleSelect = (d) => {
    onChange(d);
    // Auto-advance tab for datetime mode
    if (mode === 'datetime' && activeTab === 'date') {
      setActiveTab('time');
    }
  };

  const handleDone = () => {
    setVisible(false);
    setActiveTab(mode === 'time' ? 'time' : 'date');
  };

  // On Android, still use native picker for better UX
  if (Platform.OS === 'android') {
    const [showNative, setShowNative] = useState(false);
    const [nativeMode, setNativeMode] = useState(mode === 'time' ? 'time' : 'date');
    const [tempDate, setTempDate] = useState(validDate || new Date());

    let DateTimePicker;
    try { DateTimePicker = require('@react-native-community/datetimepicker').default; } catch (e) {}

    const handleAndroidChange = (event, selectedDate) => {
      setShowNative(false);
      if (event.type === 'set' && selectedDate) {
        if (mode === 'datetime') {
          if (nativeMode === 'date') {
            setTempDate(selectedDate);
            setNativeMode('time');
            setTimeout(() => setShowNative(true), 100);
          } else {
            const final = new Date(tempDate);
            final.setHours(selectedDate.getHours(), selectedDate.getMinutes());
            onChange(final);
            setNativeMode('date');
          }
        } else {
          onChange(selectedDate);
        }
      } else {
        setNativeMode('date');
      }
    };

    return (
      <View style={[styles.container, style]}>
        {label && (
          <Text style={styles.label}>
            {label}{required && <Text style={styles.req}> *</Text>}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.trigger, error && styles.triggerError]}
          onPress={() => {
            setTempDate(validDate || new Date());
            setNativeMode(mode === 'time' ? 'time' : 'date');
            setShowNative(true);
          }}
          activeOpacity={0.75}
        >
          <Ionicons
            name={mode === 'time' ? 'time-outline' : mode === 'datetime' ? 'calendar-number-outline' : 'calendar-outline'}
            size={16}
            color={validDate ? Colors.accent : Colors.textTertiary}
            style={{ marginRight: 6 }}
          />
          <Text 
            style={[styles.triggerText, !validDate && styles.triggerPlaceholder]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayText}
          </Text>
          <Ionicons name="chevron-down" size={14} color={Colors.textTertiary} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
        {error && <Text style={styles.error}>{error}</Text>}

        {showNative && DateTimePicker && (
          <DateTimePicker
            value={tempDate}
            mode={mode === 'datetime' ? nativeMode : mode}
            display="default"
            onChange={handleAndroidChange}
          />
        )}
      </View>
    );
  }

  // ── iOS / Web: Custom Picker Modal ──────────────────────────────────────
  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>
          {label}{required && <Text style={styles.req}> *</Text>}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.trigger, error && styles.triggerError, visible && styles.triggerOpen]}
        onPress={() => setVisible(true)}
        activeOpacity={0.75}
      >
        <Ionicons
          name={mode === 'time' ? 'time-outline' : mode === 'datetime' ? 'calendar-number-outline' : 'calendar-outline'}
          size={16}
          color={validDate ? Colors.accent : Colors.textTertiary}
          style={{ marginRight: 6 }}
        />
        <Text 
          style={[styles.triggerText, !validDate && styles.triggerPlaceholder]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayText}
        </Text>
        {validDate ? (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onChange(null); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginLeft: 4 }}
          >
            <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={14} color={Colors.textTertiary} style={{ marginLeft: 2 }} />
        )}
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleDone}
        statusBarTranslucent
      >
        <Pressable style={styles.overlay} onPress={handleDone}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation?.()}>
            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandleBar} />
              <Text style={styles.sheetTitle}>
                {mode === 'date' ? 'Select Date' : mode === 'time' ? 'Select Time' : 'Select Date & Time'}
              </Text>
              <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Tab Bar (datetime only) */}
            {mode === 'datetime' && (
              <View style={styles.tabs}>
                {[
                  { key: 'date', icon: 'calendar-outline', label: 'Date' },
                  { key: 'time', icon: 'time-outline', label: 'Time' },
                ].map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={16}
                      color={activeTab === tab.key ? Colors.accent : Colors.textTertiary}
                    />
                    <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Content */}
            <View style={styles.sheetBody}>
              {(activeTab === 'date' || mode === 'date') && (
                <CalendarPicker
                  selected={validDate}
                  onSelect={handleSelect}
                />
              )}
              {(activeTab === 'time' || mode === 'time') && (
                <TimePicker
                  selected={validDate}
                  onSelect={handleSelect}
                />
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.captionSemibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs + 2,
  },
  req: { color: Colors.danger },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm, // Reduced horizontal padding to give more room in tight columns
    minHeight: 50,
    paddingVertical: Spacing.sm,
    overflow: 'hidden', // Clips long text instead of letting it expand vertically
  },
  triggerOpen: {
    borderColor: Colors.accent,
    backgroundColor: Colors.surface,
  },
  triggerError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerLight,
  },
  triggerText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
    minWidth: 0, // Solves flexbox layout shrinking issues on React Native Web
  },
  triggerPlaceholder: {
    color: Colors.textTertiary,
  },
  error: {
    ...Typography.small,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,18,40,0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
    shadowColor: Colors.shadowDeep,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 20,
  },
  sheetHeader: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    alignItems: 'center',
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
  },
  doneBtn: {
    position: 'absolute',
    right: Spacing.xl,
    top: Spacing.md + 22,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.full,
  },
  doneBtnText: {
    ...Typography.captionSemibold,
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: 5,
  },
  tabActive: {
    backgroundColor: Colors.surface,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    ...Typography.captionMedium,
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  sheetBody: {
    padding: Spacing.xl,
  },
});

// Calendar styles
const cal = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  monthYear: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  yearScroll: {
    maxHeight: 200,
    marginBottom: Spacing.md,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  yearChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  yearChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  yearChipText: {
    ...Typography.captionMedium,
    color: Colors.textSecondary,
  },
  yearChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  dayLabels: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    ...Typography.small,
    color: Colors.textTertiary,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  cellSelected: {
    backgroundColor: Colors.accent,
  },
  cellToday: {
    backgroundColor: Colors.accentSurface,
  },
  cellText: {
    ...Typography.body,
    color: Colors.text,
    textAlign: 'center',
  },
  cellTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  cellTextToday: {
    color: Colors.accent,
    fontWeight: '700',
  },
  todayBtn: {
    marginTop: Spacing.md,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySurface,
  },
  todayBtnText: {
    ...Typography.captionSemibold,
    color: Colors.primary,
  },
});

// Time picker styles
const spin = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accentSurface,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    alignSelf: 'center',
  },
  clockText: {
    ...Typography.h2,
    color: Colors.accent,
    letterSpacing: 1,
  },
  cols: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  colWrap: {
    alignItems: 'center',
    width: 72,
  },
  colLabel: {
    ...Typography.label,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
    letterSpacing: 1,
  },
  col: {
    height: 200,
    width: 72,
  },
  separator: {
    width: 1,
    height: 200,
    backgroundColor: Colors.borderLight,
    marginTop: 28,
  },
  item: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  itemActive: {
    backgroundColor: Colors.accent,
  },
  itemText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  itemTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  ampmBtn: {
    width: 60,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.sm,
  },
  ampmBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  ampmText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  ampmTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
});
