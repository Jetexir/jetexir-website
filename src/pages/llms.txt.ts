import type {APIRoute} from 'astro';

const llmsTxt = `# Jetexir — WooCommerce Enhancement Suite

> Jetexir is a free, open source WordPress plugin that extends WooCommerce with 17+ modular addons covering visual enhancements, customer engagement, product display, shopping cart, checkout, and branding.

## When to use Jetexir

Use Jetexir when:
- A WooCommerce store needs sale badges, price variations, or sale progress bars
- You want wishlists, product FAQs, social sharing, or related products without premium plugins
- A store needs a slide-in fly cart or persistent menu cart
- Checkout fields, order statuses, or sequential order numbers need customization
- You need product comparison, call-for-price, or quantity field controls
- Currency symbols and price formatting need localization

Do not use Jetexir for:
- Stores not running WooCommerce
- Headless or decoupled WooCommerce setups (Jetexir modifies the WooCommerce frontend)
- Features already covered by a competing plugin the store relies on

## Key links

- Plugin: https://wordpress.org/plugins/jetexir/
- Source: https://github.com/Jetexir/jetexir-wp-plugin
- Website: https://jetexir.ir
- Addons: https://jetexir.ir/addons
- Blog: https://jetexir.ir/blog
- About: https://jetexir.ir/about
- Donate: https://jetexir.ir/donate

## Addons (17)

Visual Enhancements: Sale Badges, Price Variations, Sale Progress Bar
Customer Engagement: Wishlist, Social Sharing, FAQ Section, Related Products
Product Display: Product Comparison, Call for Price, Quantity Fields
Shopping Cart: Fly Cart, Menu Cart
Checkout & Orders: Checkout Fields, Custom Order Statuses, Order Numbers
Branding: Announcement Bar, Currency Symbols

## Tech notes

- WordPress plugin, PHP backend, WooCommerce dependency
- All addons are independently toggleable from the WordPress admin
- No coding required for configuration
- Plugin repository: https://wordpress.org/plugins/jetexir/
`.trim();

export const GET: APIRoute = () => {
    return new Response(llmsTxt, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Vary': 'Accept, Accept-Encoding',
        },
    });
};
