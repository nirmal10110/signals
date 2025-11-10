
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { format } from "npm:date-fns@3.6.0";

/**
 * @typedef {object} OwnerRelationship
 * @property {string} email
 * @property {string} [name]
 */

/**
 * @typedef {object} Company
 * @property {string} id
 * @property {string} name
 * @property {string} [industry]
 * @property {number} [founder_age]
 * @property {string} [ceo_founder_linkedin_url]
 * @property {boolean} [monitoring_active]
 * @property {Array<OwnerRelationship>} [relationship_owners]
 */

/**
 * @typedef {object} CompanyForHTML
 * @property {string} name
 * @property {string | undefined} industry
 * @property {number | undefined} founder_age
 * @property {string | undefined} ceo_founder_linkedin_url
 */

/**
 * Checks if an email address is a valid Volpi Capital email.
 * @param {string | null | undefined} email - The email address to validate.
 * @returns {boolean} True if the email is a valid Volpi email, false otherwise.
 */
function isValidVolpiEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return email.toLowerCase().endsWith('@volpicapital.com');
}

/**
 * Generates an HTML report for succession planning.
 * @param {string} ownerName - The name of the report owner.
 * @param {string} date - The date of the report (formatted string).
 * @param {Array<CompanyForHTML>} companies - An array of company objects.
 * @returns {string} The full HTML content of the report.
 */
function generateSuccessionHTML(ownerName, date, companies) {
    const companyRows = companies.map(company => `
        <tr>
            <td style="padding: 15px; border-bottom: 1px solid #dee2e6;">
                <p style="margin: 0; font-weight: bold; color: #1e293b;">${company.name}</p>
                <p style="margin: 4px 0 0; font-size: 12px; color: #475569;">${company.industry || 'N/A'}</p>
            </td>
            <td style="padding: 15px; border-bottom: 1px solid #dee2e6; font-size: 14px; color: #334155; text-align: center;">
                <span style="font-weight: bold; color: ${company.founder_age && company.founder_age >= 55 ? '#dc2626' : '#f59e0b'};">${company.founder_age || 'N/A'} years</span>
            </td>
            <td style="padding: 15px; border-bottom: 1px solid #dee2e6; font-size: 14px; color: #334155;">
                ${company.ceo_founder_linkedin_url ? `<a href="${company.ceo_founder_linkedin_url}" style="color: #4f46e5;">View Profile</a>` : 'N/A'}
            </td>
            <td style="padding: 15px; border-bottom: 1px solid #dee2e6; font-size: 12px; color: #475569;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; border-radius: 6px;">
                    <p style="margin: 0;"><strong>Suggested approach:</strong></p>
                    <p style="margin: 4px 0 0;">Share content on succession planning and PE partnerships. Position as thinking partner for next phase.</p>
                </div>
            </td>
        </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}</style>
    </head>
    <body style="background-color: #f1f5f9; padding: 20px;">
        <div style="max-width: 900px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 24px;">
                <h1 style="margin: 0; font-size: 24px;">Annual Succession Planning Review — ${date}</h1>
            </div>
            <div style="padding: 24px;">
                <p style="margin: 0 0 20px; font-size: 16px; color: #334155;">Hi ${ownerName},</p>
                <p style="margin: 0 0 20px; font-size: 16px; color: #334155;">
                    Here's your annual review of target companies with founders aged 50+. These represent potential succession planning conversations worth having over the next 12 months.
                </p>
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
                    <p style="margin: 0; font-size: 14px; color: #92400e;">
                        <strong>⚠️ Note:</strong> ${companies.filter(c => c.founder_age && c.founder_age >= 55).length} of these founders are 55+, entering prime succession planning age.
                    </p>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 12px 15px; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b;">Company</th>
                            <th style="text-align: center; padding: 12px 15px; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b;">Founder Age</th>
                            <th style="text-align: left; padding: 12px 15px; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b;">LinkedIn</th>
                            <th style="text-align: left; padding: 12px 15px; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b;">Suggested Approach</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${companyRows}
                    </tbody>
                </table>
                <div style="margin-top: 24px; padding: 16px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;">
                    <p style="margin: 0 0 8px; font-weight: bold; color: #0c4a6e;">📧 Email Template for Succession Conversations:</p>
                    <div style="background: #ffffff; padding: 12px; border-radius: 6px; font-size: 14px; color: #334155; font-family: monospace;">
                        <p style="margin: 0;">Hi [Name],</p>
                        <p style="margin: 8px 0;">I've been following [Company] for a while and thought you might find this useful.</p>
                        <p style="margin: 8px 0;">We recently wrote about how founders plan for the next phase of growth and succession, based on conversations with others who've been through it. Thought it might be relevant given where [Company] is today.</p>
                        <p style="margin: 8px 0;">Happy to share more if it's helpful.</p>
                        <p style="margin: 8px 0 0;">Best,<br>[Your Name]</p>
                    </div>
                </div>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 14px; color: #475569; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0;">Powered by Volpi Lens Intelligence Platform</p>
                <p style="margin: 4px 0 0; font-size: 12px;">This report is generated annually in November</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all active companies
        /** @type {Array<Company>} */
        const companies = await base44.asServiceRole.entities.Company.filter({
            monitoring_active: true
        });

        // Calculate founder ages where missing
        for (const company of companies) {
            if (company.ceo_founder_linkedin_url && !company.founder_age) {
                try {
                    const prompt = `Look up the LinkedIn profile at ${company.ceo_founder_linkedin_url}.

Find the education section and look for university start date. 
If the person started university in year XXXX, assume they were 18 years old at that time.
Calculate their current age based on that.

Return the age as a number, or null if you can't determine it.`;

                    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
                        prompt,
                        add_context_from_internet: true,
                        response_json_schema: {
                            type: "object",
                            properties: {
                                age: { type: "number" },
                                confidence: { type: "string" },
                                university_start_year: { type: "number" }
                            }
                        }
                    });

                    if (result.age) {
                        await base44.asServiceRole.entities.Company.update(company.id, {
                            founder_age: result.age
                        });
                        company.founder_age = result.age;
                        console.log(`✓ Calculated founder age for ${company.name}: ${result.age}`);
                    }

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (error) {
                    console.error(`Error calculating age for ${company.name}:`, error.message);
                }
            }
        }

        // Filter companies with founders 50+
        const successionCompanies = companies.filter(c => c.founder_age && c.founder_age >= 50);

        /** @type {Object.<string, {name: string, companies: Array<Company>}>} */
        const companiesByOwner = {};
        
        for (const company of successionCompanies) {
            const owners = company.relationship_owners || [];
            for (const owner of owners) {
                if (!owner.email) continue;
                
                if (!companiesByOwner[owner.email]) {
                    companiesByOwner[owner.email] = {
                        name: owner.name || owner.email.split('@')[0],
                        companies: []
                    };
                }
                companiesByOwner[owner.email].companies.push(company);
            }
        }

        const results = [];
        // Set the report date to November 1st of the current year
        const today = new Date();
        const reportDate = new Date(today.getFullYear(), 10, 1); // Month 10 is November
        const dateStr = format(reportDate, 'do MMMM yyyy');

        // Send succession report to each owner
        for (const [ownerEmail, data] of Object.entries(companiesByOwner)) {
            try {
                // ⚠️ SECURITY: Only send to @volpicapital.com addresses
                if (!isValidVolpiEmail(ownerEmail)) {
                    console.log(`⚠️ Skipping non-Volpi email: ${ownerEmail}`);
                    results.push({
                        owner: ownerEmail,
                        status: 'blocked',
                        reason: 'Non-Volpi email address'
                    });
                    continue;
                }

                // Sort by age descending (oldest first)
                data.companies.sort((a, b) => (b.founder_age || 0) - (a.founder_age || 0));

                const htmlBody = generateSuccessionHTML(
                    data.name,
                    dateStr,
                    data.companies
                );

                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: ownerEmail,
                    subject: `Annual Succession Planning Review — ${data.companies.length} Companies (50+ Founders)`,
                    body: htmlBody,
                    from_name: 'Volpi Lens'
                });

                results.push({
                    owner: ownerEmail,
                    companies_reported: data.companies.length,
                    status: 'sent'
                });

                console.log(`✓ Sent succession report to ${ownerEmail} with ${data.companies.length} companies`);

            } catch (error) {
                console.error(`Failed to send succession report to ${ownerEmail}:`, error.message);
                results.push({
                    owner: ownerEmail,
                    status: 'failed',
                    error: error.message
                });
            }
        }

        return Response.json({
            success: true,
            reports_sent: results.filter(r => r.status === 'sent').length,
            blocked_emails: results.filter(r => r.status === 'blocked').length,
            total_companies: successionCompanies.length,
            results
        });

    } catch (error) {
        console.error('Annual succession check error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});
