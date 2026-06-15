export const SUPPORTED_RELATIONS = ['derived_from', 'related', 'describedby', 'describes', 'prev', 'next']

export const RELATION_STYLES = {
  derived_from: {
    label: 'Derived from',
    color: '#93C5FD',
    rgba: [147, 197, 253, 235],
    lineWidth: 3.2,
    arcHeight: 0.78,
    tilt: -10,
    dashArray: null,
    markerColor: '#93C5FD',
  },
  related: {
    label: 'Related',
    color: '#60A5FA',
    rgba: [96, 165, 250, 218],
    lineWidth: 2.2,
    arcHeight: 0.42,
    tilt: 0,
    dashArray: null,
    markerColor: '#60A5FA',
  },
  describedby: {
    label: 'Described by',
    color: '#38BDF8',
    rgba: [56, 189, 248, 222],
    lineWidth: 2.6,
    arcHeight: 0.56,
    tilt: 10,
    dashArray: null,
    markerColor: '#38BDF8',
  },
  describes: {
    label: 'Describes',
    color: '#7DD3FC',
    rgba: [125, 211, 252, 222],
    lineWidth: 2.6,
    arcHeight: 0.62,
    tilt: -14,
    dashArray: null,
    markerColor: '#7DD3FC',
  },
  prev: {
    label: 'Previous',
    color: '#2563EB',
    rgba: [37, 99, 235, 225],
    lineWidth: 2.8,
    arcHeight: 0.35,
    tilt: 16,
    dashArray: null,
    markerColor: '#2563EB',
  },
  next: {
    label: 'Next',
    color: '#3B82F6',
    rgba: [59, 130, 246, 232],
    lineWidth: 3,
    arcHeight: 0.48,
    tilt: -18,
    dashArray: null,
    markerColor: '#3B82F6',
  },
}

export function getRelationStyle(rel) {
  return RELATION_STYLES[rel] || RELATION_STYLES.related
}
