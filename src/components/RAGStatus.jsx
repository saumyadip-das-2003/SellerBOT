export default function RAGStatus({ isLoading }) {
  if (!isLoading) return null

  return (
    <div className="fixed bottom-20 left-1/2 z-[999] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#1D9E75] px-4 py-2 text-sm font-medium text-white shadow-lg">
      <span>Loading AI search model (first time only)...</span>
    </div>
  )
}
