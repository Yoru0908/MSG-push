/**
 * 发现所有成员及其group_id
 * 策略：先调用 /v2/groups 获取所有groups，然后获取每个group的成员信息
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const config = require('../src/config');

async function discoverAllMembers() {
  console.log('🔍 发现所有成员及其API端点...\n');

  const result = {
    lastUpdate: new Date().toISOString(),
    totalMembers: 0,
    sites: {}
  };

  for (const site of config.sites) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📱 ${site.name}`);
    console.log(`${'='.repeat(60)}\n`);

    const apiConfig = config.api[site.slug];
    
    if (!apiConfig || !apiConfig.authorization || !apiConfig.cookie) {
      console.log('⚠️  API配置不完整，跳过');
      continue;
    }

    try {
      const client = axios.create({
        baseURL: apiConfig.baseUrl,
        timeout: 15000,
        headers: {
          'accept': 'application/json',
          'authorization': apiConfig.authorization,
          'cookie': apiConfig.cookie,
          'x-talk-app-id': apiConfig.appId,
          'x-talk-app-platform': apiConfig.appPlatform
        }
      });

      // 1. 先获取所有groups
      console.log('📡 步骤1: 调用 /v2/groups?organization_id=1');
      const groupsResp = await client.get('/v2/groups', {
        params: { organization_id: 1 }
      });
      
      console.log('📄 Groups响应:', JSON.stringify(groupsResp.data, null, 2).substring(0, 800));
      
      const groups = Array.isArray(groupsResp.data) ? groupsResp.data : 
                     groupsResp.data.groups ? groupsResp.data.groups : [];
      
      console.log(`✅ 找到 ${groups.length} 个groups\n`);

      result.sites[site.slug] = {
        name: site.name,
        baseUrl: apiConfig.baseUrl,
        mainGroupId: apiConfig.groupId,
        totalGroups: groups.length,
        totalMembers: 0,
        members: {}
      };

      // 2. 对每个group获取members（每个group可能对应一个成员）
      console.log('📡 步骤2: 获取每个group的成员信息...\n');
      
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const groupId = group.id;
        const groupName = group.name || `Group ${groupId}`;
        
        try {
          // 尝试获取这个group的members
          const membersResp = await client.get(`/v2/groups/${groupId}/members`);
          const members = Array.isArray(membersResp.data) ? membersResp.data : [];
          
          if (members.length > 0) {
            for (const member of members) {
              const memberId = member.id;
              const memberName = member.name || `Member ${memberId}`;
              
              // 避免重复
              if (result.sites[site.slug].members[memberName]) {
                continue;
              }

              result.sites[site.slug].members[memberName] = {
                id: memberId,
                name: memberName,
                personalGroupId: memberId, // 成员ID就是其个人group_id
                belongsToGroups: member.groups || [],
                thumbnail: member.thumbnail,
                phoneImage: member.phone_image,
                birthday: member.birthday,
                priority: member.priority,
                apis: {
                  timeline: `${apiConfig.baseUrl}/v2/groups/${memberId}/timeline`,
                  timelineParams: {
                    count: 200,
                    order: 'desc',
                    clear_unread: true
                  },
                  timelineExample: `${apiConfig.baseUrl}/v2/groups/${memberId}/timeline?count=200&order=desc&clear_unread=true`,
                  pastMessages: `${apiConfig.baseUrl}/v2/groups/${memberId}/past_messages`
                },
                discoveredFrom: {
                  groupId: groupId,
                  groupName: groupName
                }
              };

              result.sites[site.slug].totalMembers++;
              console.log(`  ✓ [${i + 1}/${groups.length}] ${memberName} (ID: ${memberId}, From Group: ${groupId})`);
            }
          }
          
          // 避免请求过快
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (error) {
          // 某些group可能没有members或者权限不足，跳过
          if (error.response?.status !== 404) {
            console.log(`  ⚠️  Group ${groupId} 无法访问: ${error.message}`);
          }
        }
      }

      result.totalMembers += result.sites[site.slug].totalMembers;
      console.log(`\n✅ ${site.name} 总计: ${result.sites[site.slug].totalMembers} 位成员`);

    } catch (error) {
      console.error(`❌ ${site.name} 失败:`, error.message);
      if (error.response) {
        console.error(`   状态码: ${error.response.status}`);
        console.error(`   响应: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
    }
  }

  // 保存结果
  const outputPath = './member-api-endpoints.json';
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 完成！');
  console.log('='.repeat(60));
  console.log(`总成员数: ${result.totalMembers}`);
  console.log(`保存位置: ${outputPath}`);
  console.log('\n📋 每个成员的信息包括:');
  console.log('  - 成员ID和名字');
  console.log('  - 个人group_id (用于获取timeline)');
  console.log('  - 所属groups列表');
  console.log('  - Timeline API端点');
  console.log('  - 缩略图和生日等信息');
  console.log('\n可以查看文件获取每个成员的完整API端点 🎉');
}

discoverAllMembers().catch(error => {
  console.error('\n💥 错误:', error);
  process.exit(1);
});
