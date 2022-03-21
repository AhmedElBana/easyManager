import React, { useState } from 'react';
import { ApiClient } from 'adminjs';

const api = new ApiClient()
// fetching all records
const Dashboard = (props) => {
  const [total_stores, set_total_stores] = useState("loading...");
  const [total_users, set_total_users] = useState("loading...");
  const [total_customers, set_total_customers] = useState("loading...");

  api.resourceAction({ resourceId: 'Store', actionName: 'list' }).then(results => {
    set_total_stores(results.data.meta.total)
  });
  api.resourceAction({ resourceId: 'User', actionName: 'list' }).then(results => {
    set_total_users(results.data.meta.total)
  });
  api.resourceAction({ resourceId: 'Customer', actionName: 'list' }).then(results => {
    set_total_customers(results.data.meta.total)
  });
  return (
    <div className="tradket_home">
      <div className="tradket_section xs">
        <div className="head">
          <p>Stores</p>
        </div>
        <div className="body">
            <p className="num">{total_stores}</p>
        </div>
      </div>
      <div className="tradket_section xs">
        <div className="head">
          <p>Users</p>
        </div>
        <div className="body">
            <p className="num">{total_users}</p>
        </div>
      </div>
      <div className="tradket_section xs">
        <div className="head">
          <p>Customers</p>
        </div>
        <div className="body">
            <p className="num">{total_customers}</p>
        </div>
      </div>
      {/* <div className="tradket_section">
        <div className="head">
          <p>Summary</p>
        </div>
        <div className="body">
        </div>
      </div> */}
    </div>
  )
}

export default Dashboard