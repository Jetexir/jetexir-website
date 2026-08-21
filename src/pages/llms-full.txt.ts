import type {APIRoute} from 'astro';

const llmsFullTxt = `# Jetexir — Full Documentation

## Overview

Jetexir is a free, open source WooCommerce enhancement suite. It provides 17 modular addons that improve the customer shopping experience and give store administrators better tools. The plugin is distributed through the official WordPress.org repository and developed openly on GitHub.

## Architecture

- WordPress plugin (PHP), requires WooCommerce
- 17 independent addons, each toggleable from wp-admin
- No premium tier — all features are free
- Configurable through the WordPress admin panel, no code required
- Compatible with most WordPress themes

## Addon Reference

### Visual Enhancements

**Sale Badges** — Customizable sale badges on product listings. Style colors, text, and position to match your brand.

**Price Variations** — Display price variations in flexible formats. Show price ranges, "from" pricing, or per-variation pricing clearly.

**Sale Progress Bar** — A real-time progress bar showing how many units of a sale item have been sold. Creates urgency and social proof.

### Customer Engagement

**Wishlist** — Let customers save products to a wishlist. Shareable wishlist pages drive return visits and word-of-mouth.

**Social Sharing** — One-click sharing buttons on product pages. Supports major social platforms.

**FAQ Section** — Add FAQ sections to product pages. Reduces support tickets by answering common questions inline.

**Related Products** — Smart related product suggestions based on categories and tags. Improves cross-selling.

### Product Display

**Product Comparison** — Side-by-side product comparison tables. Helps customers evaluate similar products.

**Call for Price** — Replace price displays with a "Call for Price" prompt. Ideal for quote-based or B2B catalogs.

**Quantity Fields** — Customizable quantity input fields. Set minimums, maximums, and step values per product.

### Shopping Cart

**Fly Cart** — A slide-in cart panel that appears when items are added. Customers can review and edit their cart without leaving the page.

**Menu Cart** — A persistent cart icon in the navigation menu showing item count and total. Always visible as customers browse.

### Checkout & Orders

**Checkout Fields** — Add, remove, or reorder checkout fields. Shape the checkout form to your business requirements.

**Custom Order Statuses** — Create custom order statuses beyond the WooCommerce defaults. Track orders through your unique workflow.

**Order Numbers** — Sequential, clean order numbers. Replace WooCommerce's default numbering with your preferred format.

### Branding

**Announcement Bar** — A dismissible bar at the top of the site for flash sales, news, or important notices.

**Currency Symbols** — Customize currency symbols and price formatting. Essential for stores serving international or local markets.

## Verification

- Plugin page: https://wordpress.org/plugins/jetexir/
- GitHub: https://github.com/Jetexir/jetexir-wp-plugin
- Website: https://jetexir.ir
`.trim();

export const GET: APIRoute = () => {
    return new Response(llmsFullTxt, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Vary': 'Accept, Accept-Encoding',
        },
    });
};
