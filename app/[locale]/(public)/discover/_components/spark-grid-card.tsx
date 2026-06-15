// W3.2 of discover redesign. v1 ships as a thin re-export of the existing
// RailSparkCard — the rail card already renders the spark cell with prompt
// excerpt, countdown badge, entry count, etc. The "grid context" wrapper
// behavior (flexible width) is handled at the parent grid layout level
// (justify-items-start on the grid container) rather than re-implementing
// the card chrome here.
//
// Future polish: drop the hardcoded `w-[260px]` in RailSparkCard and let
// the card fill its grid cell when consumed from the grid surface.
export { RailSparkCard as SparkGridCard } from './rail-spark-card'
