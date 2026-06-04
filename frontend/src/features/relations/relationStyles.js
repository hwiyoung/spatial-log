export const SUPPORTED_RELATIONS = ['derived_from', 'related', 'describedby', 'describes', 'prev', 'next']

export const RELATION_STYLES = {
  derived_from: {
    label: 'Derived from',
    color: '#6AAF50',
    lineWidth: 3,
    dashArray: null,
    markerColor: '#9DD67E',
  },
  related: {
    label: 'Related',
    color: '#8899AA',
    lineWidth: 2,
    dashArray: [2, 2],
    markerColor: '#AAB5C2',
  },
  describedby: {
    label: 'Described by',
    color: '#C08A42',
    lineWidth: 2.5,
    dashArray: [1, 1],
    markerColor: '#D7A45C',
  },
  describes: {
    label: 'Describes',
    color: '#D7B84A',
    lineWidth: 2.5,
    dashArray: [1, 1],
    markerColor: '#F0D56A',
  },
  prev: {
    label: 'Previous',
    color: '#7A8CFF',
    lineWidth: 2.5,
    dashArray: [6, 2],
    markerColor: '#A5B0FF',
  },
  next: {
    label: 'Next',
    color: '#4AA3FF',
    lineWidth: 2.5,
    dashArray: [6, 2],
    markerColor: '#7BBEFF',
  },
}

export function getRelationStyle(rel) {
  return RELATION_STYLES[rel] || RELATION_STYLES.related
}
