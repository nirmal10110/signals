import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const companies = await base44.asServiceRole.entities.Company.filter({
            monitoring_active: true
        });

        const today = new Date();
        const twoDaysFromNow = new Date(today);
        twoDaysFromNow.setDate(today.getDate() + 2);

        const birthdayAlerts = [];

        for (const company of companies) {
            if (!company.key_contacts || company.key_contacts.length === 0) continue;

            for (const contact of company.key_contacts) {
                if (!contact.birthday) continue;

                const birthday = new Date(contact.birthday);
                const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
                
                // Check if birthday is today (day-of reminder)
                if (thisYearBirthday.toDateString() === today.toDateString()) {
                    const alert = await base44.asServiceRole.entities.Alert.create({
                        company_id: company.id,
                        company_name: company.name,
                        trigger_type: 'birthday_reminder',
                        headline: `🎂 ${contact.name}'s Birthday - TODAY`,
                        summary: `${contact.name} (${contact.title}) at ${company.name} celebrates their birthday today. Perfect opportunity for a personal touch.`,
                        tier: 'tier_1',
                        priority: 'high',
                        status: 'new',
                        actionable_insight: `Send a personal birthday message or small gift to strengthen the relationship.`,
                        draft_email: `Dear ${contact.name.split(' ')[0]},\n\nMany happy returns on your birthday! Wishing you a wonderful day and a fantastic year ahead.\n\nWarm regards,\nThe Volpi Capital Team`,
                        detected_date: today.toISOString().split('T')[0]
                    });
                    
                    birthdayAlerts.push(alert);

                    // Send email notification
                    if (user?.email) {
                        await base44.asServiceRole.integrations.Core.SendEmail({
                            to: user.email,
                            subject: `[Volpi Lens] 🎂 Birthday TODAY - ${contact.name} at ${company.name}`,
                            body: `Birthday Alert - TODAY\n\nContact: ${contact.name}\nTitle: ${contact.title}\nCompany: ${company.name}\n\nSend a personal message to strengthen the relationship!`
                        });
                    }
                }
                
                // Check if birthday is in 2 days (advance reminder)
                else if (thisYearBirthday.toDateString() === twoDaysFromNow.toDateString()) {
                    const alert = await base44.asServiceRole.entities.Alert.create({
                        company_id: company.id,
                        company_name: company.name,
                        trigger_type: 'birthday_reminder',
                        headline: `🎂 ${contact.name}'s Birthday in 2 Days`,
                        summary: `${contact.name} (${contact.title}) at ${company.name} has a birthday coming up in 2 days.`,
                        tier: 'tier_2',
                        priority: 'medium',
                        status: 'new',
                        actionable_insight: `Prepare a birthday message or gift to send on the day.`,
                        detected_date: thisYearBirthday.toISOString().split('T')[0]
                    });
                    
                    birthdayAlerts.push(alert);
                }
            }
        }

        return Response.json({
            success: true,
            birthday_alerts: birthdayAlerts.length,
            alerts: birthdayAlerts
        });

    } catch (error) {
        console.error('Birthday check error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});