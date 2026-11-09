import React, { memo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlideToAccept } from './SlideToAccept';
import { parseViaStops } from '../app/dashboard';
import {
  formatTripDateTime,
  parseCustomerRequirements,
  extractCustomerNotes,
} from '../lib/tripRequirements';

interface BroadcastCardProps {
  dispatch: any;
  isAccepting: boolean;
  onAccept: (dispatchId: string) => Promise<void>;
  onDecline: (dispatchId: string) => Promise<void>;
}

export const BroadcastCard = memo(function BroadcastCard({
  dispatch,
  isAccepting,
  onAccept,
  onDecline,
}: BroadcastCardProps) {
  const b = dispatch.booking;
  if (!b) return null;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeDot}>●</Text>
            <Text style={styles.liveBadgeText}>BROADCAST RIDE</Text>
          </View>
          <Text style={styles.tripTypeBadge}>{b.tripType || 'ONEWAY'}</Text>
        </View>
        <View style={styles.priceTag}>
          <Text style={styles.priceLabel}>DISTANCE</Text>
          <Text style={styles.priceValue}>
            {b.distanceKm || '--'} km
          </Text>
        </View>
      </View>

      {/* Trip Date & Pickup Time Banner */}
      <View style={styles.tripDateBanner}>
        <View style={styles.tripDateBannerLeft}>
          <Ionicons name="calendar" size={13} color="#0284c7" />
          <Text style={styles.tripDateBannerLabel}>PICKUP DATE & TIME:</Text>
          <Text style={styles.tripDateBannerValue}>
            {formatTripDateTime(b.scheduledAt).fullText}
          </Text>
        </View>
        {formatTripDateTime(b.scheduledAt).isToday ? (
          <View style={styles.todayTagPill}>
            <Text style={styles.todayTagText}>TODAY</Text>
          </View>
        ) : formatTripDateTime(b.scheduledAt).isTomorrow ? (
          <View style={styles.tomorrowTagPill}>
            <Text style={styles.tomorrowTagText}>TOMORROW</Text>
          </View>
        ) : null}
      </View>

      {/* Route Info */}
      <View style={styles.routeContainer}>
        <View style={styles.routePoint}>
          <Text style={styles.pointDotGreen}>🟢</Text>
          <View style={styles.pointTextContainer}>
            <Text style={styles.pointLabel}>PICKUP</Text>
            <Text style={styles.pointValue} numberOfLines={2}>
              {b.pickupAddress}
            </Text>
          </View>
        </View>

        {parseViaStops(b).map((stopName: string, idx: number) => (
          <React.Fragment key={idx}>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <View style={styles.viaDotBadge}>
                <Text style={styles.viaDotNum}>{idx + 1}</Text>
              </View>
              <View style={styles.pointTextContainer}>
                <Text style={styles.viaPointLabel}>VIA STOP #{idx + 1}</Text>
                <Text style={styles.pointValue} numberOfLines={2}>
                  {stopName}
                </Text>
              </View>
            </View>
          </React.Fragment>
        ))}

        <View style={styles.routeLine} />

        <View style={styles.routePoint}>
          <Text style={styles.pointDotRed}>🔴</Text>
          <View style={styles.pointTextContainer}>
            <Text style={styles.pointLabel}>DROP DESTINATION</Text>
            <Text style={styles.pointValue} numberOfLines={2}>
              {b.dropAddress}
            </Text>
          </View>
        </View>
      </View>

      {/* Customer Requirements & Preferences */}
      {(() => {
        const reqs = parseCustomerRequirements(b);
        const note = extractCustomerNotes(b);
        if (reqs.length === 0 && !note) return null;

        return (
          <View style={styles.reqsSection}>
            <View style={styles.reqsHeaderRow}>
              <Ionicons name="options-outline" size={12} color="#64748b" />
              <Text style={styles.reqsHeading}>CUSTOMER REQUIREMENTS</Text>
            </View>
            <View style={styles.reqsRow}>
              {reqs.map((r, rIdx) => (
                <React.Fragment key={`b-req-${rIdx}`}>
                  {rIdx > 0 && <View style={styles.reqLineSeparator} />}
                  <View style={styles.reqPill}>
                    <Ionicons
                      name={r.icon as any}
                      size={12}
                      color={
                        r.type === 'highlight'
                          ? '#fdba74'
                          : r.type === 'warning'
                          ? '#fde047'
                          : r.type === 'info'
                          ? '#93c5fd'
                          : '#cbd5e1'
                      }
                    />
                    <Text
                      style={[
                        styles.reqPillText,
                        r.type === 'highlight' && styles.reqPillTextHighlight,
                        r.type === 'warning' && styles.reqPillTextWarning,
                        r.type === 'info' && styles.reqPillTextInfo,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
            {note ? (
              <View style={styles.notesBox}>
                <Ionicons name="chatbubble-ellipses-outline" size={12} color="#475569" style={{ marginTop: 1 }} />
                <Text style={styles.notesText} numberOfLines={2}>
                  Note: "{note}"
                </Text>
              </View>
            ) : null}
          </View>
        );
      })()}

      {/* Trip Meta */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color="#64748b" />
          <Text style={styles.metaText}>
            {b.scheduledAt ? new Date(b.scheduledAt).toLocaleDateString() : 'Immediate'}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="car-outline" size={14} color="#64748b" />
          <Text style={styles.metaText}>{b.category || 'SEDAN'}</Text>
        </View>
        {b.estimatedDistanceKm ? (
          <View style={styles.metaItem}>
            <Ionicons name="speedometer-outline" size={14} color="#64748b" />
            <Text style={styles.metaText}>{b.estimatedDistanceKm} km</Text>
          </View>
        ) : null}
      </View>

      {/* Slide To Accept or Decline */}
      <View style={styles.actionContainer}>
        <SlideToAccept
          onAccept={() => onAccept(dispatch.id)}
          disabled={isAccepting}
          isAccepting={isAccepting}
          title="Slide to Accept Ride →"
          acceptingTitle="Accepting..."
        />
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={() => {
            Alert.alert(
              'Decline Ride',
              'Are you sure you want to pass on this ride request?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Decline', style: 'destructive', onPress: () => onDecline(dispatch.id) },
              ]
            );
          }}
          disabled={isAccepting}
        >
          <Text style={styles.declineBtnText}>Pass / Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  liveBadgeDot: {
    color: '#ef4444',
    fontSize: 8,
  },
  liveBadgeText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tripTypeBadge: {
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    fontSize: 10,
    fontWeight: '800',
  },
  priceTag: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '700',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#34d399',
  },
  routeContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pointDotGreen: {
    fontSize: 14,
    marginTop: 2,
  },
  pointDotRed: {
    fontSize: 14,
    marginTop: 2,
  },
  pointTextContainer: {
    flex: 1,
  },
  pointLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  pointValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f1f5f9',
    marginTop: 1,
  },
  routeLine: {
    width: 2,
    height: 14,
    backgroundColor: '#334155',
    marginLeft: 7,
    marginVertical: 3,
  },
  viaDotBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  viaDotNum: {
    fontSize: 9,
    fontWeight: '800',
    color: '#92400e',
  },
  viaPointLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#f59e0b',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  actionContainer: {
    gap: 8,
  },
  declineBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  declineBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  tripDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingVertical: 5,
    marginBottom: 8,
  },
  tripDateBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    flexWrap: 'wrap',
  },
  tripDateBannerLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  tripDateBannerValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f8fafc',
  },
  todayTagPill: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#4ade80',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  todayTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#4ade80',
    letterSpacing: 0.5,
  },
  tomorrowTagPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  tomorrowTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 0.5,
  },
  reqsSection: {
    paddingHorizontal: 2,
    paddingVertical: 5,
    marginBottom: 8,
  },
  reqsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  reqsHeading: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  reqsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
  },
  reqPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  reqPillHighlight: {},
  reqPillWarning: {},
  reqPillInfo: {},
  reqLineSeparator: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  reqPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  reqPillTextHighlight: {
    color: '#fdba74',
  },
  reqPillTextWarning: {
    color: '#fde047',
  },
  reqPillTextInfo: {
    color: '#93c5fd',
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  notesText: {
    flex: 1,
    fontSize: 10.5,
    fontStyle: 'italic',
    color: '#cbd5e1',
  },
});
