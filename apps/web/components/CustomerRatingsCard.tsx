'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface UserReview {
  name: string;
  rating: number;
  comment: string;
  tags: string[];
  date: string;
}

const QUICK_TAGS = ['On-time Pickup', 'Clean & Sanitized', 'Polite Driver', 'Smooth Drive', 'Fair Pricing'];

export function CustomerRatingsCard() {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [name, setName] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['On-time Pickup', 'Clean & Sanitized']);
  const [submittedReview, setSubmittedReview] = useState<UserReview | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pre-fill name if user is logged in
  useEffect(() => {
    if (user?.fullName) {
      setName(user.fullName);
    }
    // Check if user previously submitted a review in this session
    try {
      const saved = localStorage.getItem('kandy_customer_review');
      if (saved) {
        setSubmittedReview(JSON.parse(saved));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [user]);

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setErrorMsg('Please write a brief comment about your experience');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);

    const newReview: UserReview = {
      name: name.trim() || 'Happy Customer',
      rating,
      comment: comment.trim(),
      tags: selectedTags,
      date: 'Just now',
    };

    setTimeout(() => {
      setSubmittedReview(newReview);
      setSubmitting(false);
      try {
        localStorage.setItem('kandy_customer_review', JSON.stringify(newReview));
      } catch {
        // Ignore localStorage errors
      }
    }, 400);
  };

  const handleReset = () => {
    setSubmittedReview(null);
    setComment('');
    try {
      localStorage.removeItem('kandy_customer_review');
    } catch {
      // Ignore
    }
  };

  // If review is submitted, show the submitted review
  if (submittedReview) {
    return (
      <div className="flex flex-col justify-between h-full p-2 select-none">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm border border-emerald-100">
                ✓
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                  Review Submitted!
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Thank you for your valuable feedback.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full">
              <span className="text-xs font-black text-[#f0750f]">{submittedReview.rating}.0</span>
              <div className="flex text-amber-400 text-xs">
                {'★'.repeat(submittedReview.rating)}
              </div>
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800">
                {submittedReview.name}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {submittedReview.date}
              </span>
            </div>

            <p className="text-xs font-medium text-slate-600 italic leading-relaxed">
              &ldquo;{submittedReview.comment}&rdquo;
            </p>

            {submittedReview.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {submittedReview.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50/80 border border-emerald-100 px-2 py-0.5 rounded-full"
                  >
                    ✓ {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400 font-medium">
            Your review is now live
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-bold text-[#f0750f] hover:text-[#ea580c] underline"
          >
            Write Another Review
          </button>
        </div>
      </div>
    );
  }

  // Interactive Review Form without outer box
  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col justify-between h-full p-2 select-none"
    >
      <div className="space-y-2">
        {/* Header: Title + Star Selector */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
              Add Your Review
            </h4>
            <p className="text-[10.5px] text-slate-500 font-medium">
              Share your experience with Kandy Cabs
            </p>
          </div>

          {/* Interactive Star Picker */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-xl">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-base transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                >
                  <span
                    className={
                      star <= (hoverRating || rating)
                        ? 'text-amber-400'
                        : 'text-slate-200'
                    }
                  >
                    ★
                  </span>
                </button>
              ))}
            </div>
            <span className="text-xs font-black text-[#f0750f] ml-1">
              {hoverRating || rating}.0
            </span>
          </div>
        </div>

        {/* Name input */}
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your Name (e.g. Ramesh Shetty)"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#f0750f] focus:bg-white transition-all"
          />
        </div>

        {/* Comment textarea */}
        <div>
          <textarea
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="Write your comments and review about our cab, driver, or service..."
            rows={2}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#f0750f] focus:bg-white transition-all resize-none leading-relaxed"
          />
        </div>

        {/* Quick Tag Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagToggle(tag)}
                className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                  isSelected
                    ? 'bg-orange-50 text-[#f0750f] border-orange-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {isSelected ? '✓ ' : '+ '}
                {tag}
              </button>
            );
          })}
        </div>

        {errorMsg && (
          <p className="text-[11px] font-semibold text-red-500">
            {errorMsg}
          </p>
        )}
      </div>

      {/* Footer: Submit Action */}
      <div className="pt-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-medium">
          Verified Reviews • Zero Spam
        </span>

        <button
          type="submit"
          disabled={submitting}
          className="bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.98] disabled:opacity-50 text-white font-extrabold text-xs px-5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 uppercase tracking-wider"
        >
          {submitting ? 'Submitting...' : 'Submit Review →'}
        </button>
      </div>
    </form>
  );
}
