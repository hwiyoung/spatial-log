function firstAssetTitle(assets) {
  return Object.values(assets || {}).find(asset => asset?.title)?.title
}

function firstNonEmpty(values) {
  return values.find(value => String(value || '').trim()) || null
}

export function getDisplayLabel(item) {
  const props = item?.properties || {}
  return firstNonEmpty([
    props.title,
    props.display_name,
    props['document:title'],
    firstAssetTitle(item?.assets),
    props.description,
    props.originalFilename,
    props['file:name'],
    item?.id,
  ]) || 'Untitled Item'
}

export function getOriginalFilename(item) {
  const props = item?.properties || {}
  return firstNonEmpty([
    props.originalFilename,
    props['file:name'],
    props.filename,
    props.name,
  ])
}
