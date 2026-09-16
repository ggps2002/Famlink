// models/Blog.ts

import mongoose, { Schema } from 'mongoose';

const BlogSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    // The public URL segment: /resources/<slug>.
    //
    // Added because the three original resources were hardcoded in the frontend
    // and addressed by slug, while database blogs were addressed by Mongo id.
    // Two URL shapes for one kind of thing meant the admin could not edit the
    // hardcoded ones and the two sets could never merge into one list.
    //
    // Generated from the title and then FROZEN — see src/modules/blog/blogSlug.js.
    // Retitling a published article must not change its address: the weekly
    // resources email links to it, and Google has indexed it.
    //
    // `sparse` so blogs that predate this field don't collide on null.
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },

    excerpt: {
      type: String,
      required: true,
      maxlength: 300,
    },
    content: {
      type: String,
      required: true,
    },
    featuredImage: {
      type: String,
    },
    isDraft: {
        type: Boolean,
        required: true,
    },

    // When it first went live. Distinct from `createdAt`, which is when the
    // draft was started — an article written in January and published in March
    // should be dated March on the public page, and ordering the resources list
    // by creation would put a long-gestating draft above things published after
    // it. Null while it has never been published.
    publishedAt: {
      type: Date,
      default: null,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Tips for Parents',
        'Tips For Nannies',
        'Platform Tips',
        'Special Needs Care',
        'Do It Yourself',
        'Nanny Activities',
        'News',
      ],
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

export default mongoose.models.Blog || mongoose.model('Blog', BlogSchema);
