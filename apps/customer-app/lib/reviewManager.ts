type ReviewListener = (booking: any | null) => void;
type SubmissionListener = (data: { bookingId: string; [key: string]: any }) => void;

class ReviewManager {
  private currentBooking: any | null = null;
  private dismissedBookings: Set<string> = new Set();
  private reviewListeners: Set<ReviewListener> = new Set();
  private submissionListeners: Set<SubmissionListener> = new Set();

  public showReview(booking: any) {
    if (!booking) return;
    const bId = booking.id || booking.bookingId;
    if (!bId || this.dismissedBookings.has(bId)) return;

    this.currentBooking = booking;
    this.notifyReviewListeners();
  }

  public forceShowReview(booking: any) {
    if (!booking) return;
    this.currentBooking = booking;
    this.notifyReviewListeners();
  }

  public closeReview() {
    if (this.currentBooking) {
      const bId = this.currentBooking.id || this.currentBooking.bookingId;
      if (bId) this.dismissedBookings.add(bId);
    }
    this.currentBooking = null;
    this.notifyReviewListeners();
  }

  public markSubmitted(ratingData: { bookingId: string; [key: string]: any }) {
    if (ratingData?.bookingId) {
      this.dismissedBookings.add(ratingData.bookingId);
    }
    this.currentBooking = null;
    this.notifyReviewListeners();
    this.submissionListeners.forEach((fn) => {
      try {
        fn(ratingData);
      } catch (err) {
        console.error('Error in review submission listener:', err);
      }
    });
  }

  public isDismissed(bookingId: string): boolean {
    return this.dismissedBookings.has(bookingId);
  }

  public getCurrentBooking(): any | null {
    return this.currentBooking;
  }

  public subscribe(listener: ReviewListener): () => void {
    this.reviewListeners.add(listener);
    listener(this.currentBooking);
    return () => {
      this.reviewListeners.delete(listener);
    };
  }

  public onSubmission(listener: SubmissionListener): () => void {
    this.submissionListeners.add(listener);
    return () => {
      this.submissionListeners.delete(listener);
    };
  }

  private notifyReviewListeners() {
    this.reviewListeners.forEach((fn) => {
      try {
        fn(this.currentBooking);
      } catch (err) {
        console.error('Error in review listener:', err);
      }
    });
  }
}

export const reviewManager = new ReviewManager();
