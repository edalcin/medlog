const mysql=require('mysql2/promise');
(async()=>{
  const c=await mysql.createConnection({host:'192.168.1.10',port:3333,user:'medlog',password:'medlog',database:'medlog'});
  const [rows]=await c.query("SHOW TABLES LIKE '_prisma_migrations'");
  console.log('tables match:', rows);
  if(rows.length){
    const [data]=await c.query("SELECT id,name,finished_at,logs,rolled_back_at FROM _prisma_migrations");
    console.log('migration rows:', data);
  }
  process.exit(0);
})();