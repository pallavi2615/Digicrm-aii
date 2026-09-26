DO $$
DECLARE o uuid := 'fde5c306-341f-47ca-8174-c8ff0b0d847f'; sd uuid; d1 uuid; d2 uuid; r1 uuid; r2 uuid; r3 uuid; r4 uuid; p1 uuid; p2 uuid; p3 uuid; ord uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.dist_partners WHERE owner_id = o) THEN RETURN; END IF;
  INSERT INTO public.dist_partners(owner_id,level,name,owner_name,phone,city,state,territory,credit_limit,payment_terms_days,onboarding_stage,gstin)
    VALUES (o,'Super Distributor','North India Traders','Vikram Malhotra','9810011223','Delhi','Delhi','North',5000000,45,'Active','07AABCN1234F1Z5') RETURNING id INTO sd;
  INSERT INTO public.dist_partners(owner_id,parent_id,level,name,owner_name,phone,city,state,territory,credit_limit,payment_terms_days,onboarding_stage,sales_rep)
    VALUES (o,sd,'Distributor','Noida Distributors','Amit Gupta','9811122334','Noida','Uttar Pradesh','Noida',1500000,30,'Active','Rahul') RETURNING id INTO d1;
  INSERT INTO public.dist_partners(owner_id,parent_id,level,name,owner_name,phone,city,state,territory,credit_limit,payment_terms_days,onboarding_stage,sales_rep)
    VALUES (o,sd,'Distributor','Ghaziabad Agencies','Sunil Jain','9812233445','Ghaziabad','Uttar Pradesh','Ghaziabad',1200000,30,'Active','Priya') RETURNING id INTO d2;
  INSERT INTO public.dist_partners(owner_id,parent_id,level,name,owner_name,phone,city,state,territory,credit_limit,payment_terms_days,onboarding_stage,sales_rep)
    VALUES (o,d1,'Retailer','Sharma General Store','Ramesh Sharma','9899001122','Noida','Uttar Pradesh','Noida',100000,15,'Active','Rahul') RETURNING id INTO r1;
  INSERT INTO public.dist_partners(owner_id,parent_id,level,name,owner_name,phone,city,state,territory,credit_limit,payment_terms_days,onboarding_stage,sales_rep)
    VALUES (o,d1,'Retailer','Gupta Kirana','Mohan Gupta','9899002233','Noida','Uttar Pradesh','Noida',80000,15,'Active','Rahul') RETURNING id INTO r2;
  INSERT INTO public.dist_partners(owner_id,parent_id,level,name,owner_name,phone,city,state,territory,credit_limit,payment_terms_days,onboarding_stage,sales_rep)
    VALUES (o,d2,'Retailer','Agarwal Mart','Deepak Agarwal','9899003344','Ghaziabad','Uttar Pradesh','Ghaziabad',120000,15,'Active','Priya') RETURNING id INTO r3;
  INSERT INTO public.dist_partners(owner_id,parent_id,level,name,owner_name,phone,city,state,territory,credit_limit,payment_terms_days,onboarding_stage,sales_rep)
    VALUES (o,d2,'Dealer','Verma Traders','Ajay Verma','9899004455','Ghaziabad','Uttar Pradesh','Ghaziabad',300000,30,'KYC','Priya') RETURNING id INTO r4;
  INSERT INTO public.dist_products(owner_id,sku,name,category,price,stock,reorder_level,daily_run_rate) VALUES (o,'XYZ-500','XYZ Biscuits 500g','Biscuits',1850,420,100,25) RETURNING id INTO p1;
  INSERT INTO public.dist_products(owner_id,sku,name,category,price,stock,reorder_level,daily_run_rate) VALUES (o,'ABC-1L','ABC Juice 1L','Beverages',2200,60,80,12) RETURNING id INTO p2;
  INSERT INTO public.dist_products(owner_id,sku,name,category,price,stock,reorder_level,daily_run_rate,expiry_date) VALUES (o,'MNO-200','MNO Namkeen 200g','Snacks',1400,300,60,6,current_date+40) RETURNING id INTO p3;
  INSERT INTO public.dist_schemes(owner_id,name,kind,product_id,buy_qty,free_qty) VALUES (o,'XYZ 10+1','Quantity',p1,10,1);
  INSERT INTO public.dist_schemes(owner_id,name,kind,min_value,discount_pct) VALUES (o,'₹50k slab 3% off','Value',50000,3);
  INSERT INTO public.dist_targets(owner_id,scope,scope_name,target) VALUES (o,'Company','Company',1500000);
  INSERT INTO public.dist_targets(owner_id,scope,scope_name,target,incentive_type,incentive_value) VALUES (o,'Salesperson','Rahul',400000,'Flat ₹',25000);
  INSERT INTO public.dist_orders(owner_id,partner_id,status,subtotal,total,sales_rep,order_date,source) VALUES (o,r1,'Delivered',37000,37000,'Rahul',current_date-3,'WhatsApp') RETURNING id INTO ord;
  INSERT INTO public.dist_order_items(owner_id,order_id,product_id,qty,free_qty,price,scheme,line_total) VALUES (o,ord,p1,20,2,1850,'XYZ 10+1',37000);
  INSERT INTO public.dist_orders(owner_id,partner_id,status,subtotal,total,sales_rep,order_date) VALUES (o,r3,'Dispatched',66000,64020,'Priya',current_date-20) RETURNING id INTO ord;
  INSERT INTO public.dist_order_items(owner_id,order_id,product_id,qty,price,line_total) VALUES (o,ord,p2,30,2200,66000);
  INSERT INTO public.dist_orders(owner_id,partner_id,status,subtotal,total,sales_rep,order_date) VALUES (o,d1,'Approved',140000,135800,'Rahul',current_date-1) RETURNING id INTO ord;
  INSERT INTO public.dist_order_items(owner_id,order_id,product_id,qty,price,line_total) VALUES (o,ord,p3,100,1400,140000);
  INSERT INTO public.dist_collections(owner_id,partner_id,amount,method,reference,collected_by) VALUES (o,r1,20000,'UPI','UPI-883311','Rahul');
  INSERT INTO public.dist_beats(owner_id,sales_rep,weekday,area,partner_ids) VALUES (o,'Rahul',extract(isodow from current_date)::int,'Noida',ARRAY[r1,r2]);
  INSERT INTO public.dist_loyalty(owner_id,partner_id,points,reason) VALUES (o,r1,370,'Order seed');
END $$;