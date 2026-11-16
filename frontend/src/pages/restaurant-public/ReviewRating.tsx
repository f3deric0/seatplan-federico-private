import type { ReviewSummary } from "../../api/discovery";
import chair from "../../design/review-chair.webp";
import "./reviews.css";

const number = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function ReviewRating({ summary }: { summary: ReviewSummary }) {
  if (summary.average === null) return <span className="review-count">No reviews yet</span>;
  return (
    <span className="review-rating">
      <span className="review-score">
        <span className="visually-hidden">Rated </span>{number.format(summary.average)}
        <span className="visually-hidden"> out of 5 tables</span>
        <span className="review-chair"><img src={chair} alt="" /></span>
      </span>
      <span className="review-count">From {summary.count} {summary.count === 1 ? "review" : "reviews"}</span>
    </span>
  );
}
