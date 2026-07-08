const CONCEPT_WRITE_FIELDS = [
  ['sams:site_concept', 'site_concept'],
  ['sams:target_concept', 'target_concept'],
]

export function buildOntologyWritePreview(row, decision) {
  if (!row || row.excluded || decision !== 'confirmed') return null

  const ontology = row.ontology || {}
  const fields = {}
  CONCEPT_WRITE_FIELDS.forEach(([stacField, ontologyKey]) => {
    const value = ontology[ontologyKey]
    if (value) fields[stacField] = value
  })
  if (Object.keys(fields).length === 0) return null

  if (ontology.ontology_version) {
    fields['sams:ontology_version'] = ontology.ontology_version
  }

  return {
    idx: row.idx,
    filename: row.filename,
    filePath: row.filePath,
    fields,
    fieldCount: Object.keys(fields).length,
    sideEffects: 'none',
    includedInRegisterPayload: false,
  }
}

export function buildOntologyWritePreviews(rows, decisions = {}) {
  return rows
    .map(row => buildOntologyWritePreview(row, decisions[row.idx] || ''))
    .filter(Boolean)
}

export function summarizeOntologyWritePreviews(previews) {
  const fields = {}
  previews.forEach(preview => {
    Object.keys(preview.fields).forEach(field => {
      fields[field] = (fields[field] || 0) + 1
    })
  })
  return {
    items: previews.length,
    fields,
    fieldCount: Object.values(fields).reduce((sum, count) => sum + count, 0),
  }
}

export function formatOntologyWriteField(field) {
  if (field === 'sams:site_concept') return 'Site ID'
  if (field === 'sams:target_concept') return 'Target ID'
  if (field === 'sams:ontology_version') return 'Ontology version'
  return field
}
